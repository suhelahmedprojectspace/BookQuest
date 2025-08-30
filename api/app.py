import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from werkzeug.security import generate_password_hash, check_password_hash
from sklearn.decomposition import TruncatedSVD
from scipy.sparse import csr_matrix
import os
import requests
import sqlite3
from contextlib import contextmanager
from functools import wraps
import jwt
from datetime import datetime, timedelta
from urllib.parse import unquote
import re
from collections import Counter
from dotenv import load_dotenv
import threading
import time

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Use environment variables for secrets
app.secret_key = os.getenv('SECRET_KEY', 'fallback-secret-key-for-development')

# Update CORS to include your deployed frontend URL
CORS(app, 
     origins=[
         "http://localhost:3000", 
         "http://127.0.0.1:3000",
         "https://*.vercel.app",  # Allow all Vercel deployments
         "https://bookquest-4.onrender.com"  # Your backend URL
     ],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=True,
     max_age=86400
)

basedir = os.path.abspath(os.path.dirname(__file__))
CSV_PATH = os.path.join(basedir, 'Books.csv')
DB_PATH = os.path.join(basedir, 'readly.db')

# Global variables for models - LAZY LOADING IMPLEMENTATION
content_model = None
collaborative_model = None
data = None
user_item_matrix = None
book_features = None
vectorizer = None
_data_loaded = False
_data_loading = False
_load_lock = threading.Lock()

def get_current_timestamp():
    """Get current timestamp as ISO string for SQLite"""
    return datetime.now().isoformat()

def init_db():
    """Initialize SQLite database for analytics, user data, and authentication"""
    conn = sqlite3.connect(DB_PATH)
    
    # Create users table for authentication
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    # Create existing tables
    conn.execute('''
        CREATE TABLE IF NOT EXISTS searches (
            id INTEGER PRIMARY KEY,
            query TEXT,
            timestamp TEXT,
            results_count INTEGER
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY,
            book_title TEXT,
            rating INTEGER,
            timestamp TEXT,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY,
            book_title TEXT,
            book_author TEXT,
            book_image TEXT,
            timestamp TEXT,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            preferred_genres TEXT,
            preferred_authors TEXT,
            reading_level TEXT,
            timestamp TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS book_analytics (
            id INTEGER PRIMARY KEY,
            book_title TEXT,
            view_count INTEGER DEFAULT 0,
            recommendation_count INTEGER DEFAULT 0,
            click_count INTEGER DEFAULT 0,
            last_accessed TEXT
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            session_start TEXT,
            session_end TEXT,
            pages_viewed INTEGER DEFAULT 0,
            searches_performed INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.commit()
    conn.close()

@contextmanager
def get_db_connection():
    """Database connection context manager"""
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
    finally:
        conn.close()

def generate_auth_token(user_id, username):
    """Generate JWT token for user authentication"""
    jwt_secret = os.getenv('JWT_SECRET_KEY', app.secret_key)
    payload = {
        'user_id': user_id,
        'username': username,
        'exp': datetime.utcnow() + timedelta(days=7),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, jwt_secret, algorithm='HS256')

def verify_auth_token(token):
    """Verify JWT token and return user info"""
    try:
        jwt_secret = os.getenv('JWT_SECRET_KEY', app.secret_key)
        payload = jwt.decode(token, jwt_secret, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def auth_required(f):
    """Decorator to protect routes that require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Authentication token required'}), 401
        
        # Remove "Bearer " prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
        
        user_info = verify_auth_token(token)
        if not user_info:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Make user info available to the route
        request.current_user = user_info
        return f(*args, **kwargs)
    
    return decorated_function

def load_data_and_models():
    """LAZY LOADING: Load data and create ML models only when first needed"""
    global content_model, collaborative_model, data, user_item_matrix, book_features, vectorizer
    global _data_loaded, _data_loading
    
    with _load_lock:
        if _data_loaded:
            return True
            
        if _data_loading:
            return False
            
        _data_loading = True
        
        try:
            print("🔄 LAZY LOADING: Starting dataset and model loading...")
            start_time = time.time()
            
            # Load data with proper column mapping
            data = pd.read_csv(CSV_PATH, low_memory=False, chunksize=50000)
            if hasattr(data, '__iter__'):  
                data = pd.concat(data, ignore_index=True)
            print(f"📊 Loaded {len(data)} books in {time.time() - start_time:.2f}s")
            print(f"📊 Dataset columns: {list(data.columns)}")
            
            # Map column names to standard names
            column_mapping = {
                'Book-Title': 'title',
                'Book-Author': 'author', 
                'Publisher': 'publisher',
                'Year-Of-Publication': 'year',
                'Image-URL-M': 'image',
                'Image-URL-S': 'image_small',
                'Image-URL-L': 'image_large',
                'ISBN': 'isbn'
            }
            
            # Rename columns to match our code
            data = data.rename(columns=column_mapping)
            
            # Clean the data
            data = data.dropna(subset=['title', 'author'])  # Remove rows with missing essential data
            data['title'] = data['title'].astype(str).str.strip()
            data['author'] = data['author'].astype(str).str.strip()
            data['publisher'] = data['publisher'].fillna('Unknown Publisher').astype(str)
            data['year'] = pd.to_numeric(data['year'], errors='coerce').fillna(2000).astype(int)
            
            # Create synthetic ratings since your dataset doesn't have them
            np.random.seed(42)
            data['rating'] = np.random.uniform(3.0, 9.5, len(data))
            data['rating'] = data['rating'].round(1)
            
            # Create synthetic user ratings for collaborative filtering
            data['user_ratings'] = np.random.randint(50, 500, len(data))
            
            # Create genre column based on title and author analysis
            data['genre'] = 'General Fiction'  # Default
            
            genre_keywords = {
                'Mystery/Thriller': ['mystery', 'detective', 'murder', 'crime', 'investigation', 'thriller', 'suspense', 'police', 'criminal'],
                'Romance': ['love', 'romance', 'heart', 'passion', 'wedding', 'bride', 'kiss', 'dating', 'relationship'],
                'Fantasy': ['magic', 'wizard', 'dragon', 'fantasy', 'enchanted', 'spell', 'realm', 'fairy', 'mythical', 'quest'],
                'Science Fiction': ['space', 'future', 'robot', 'sci-fi', 'alien', 'galaxy', 'time', 'technology', 'mars', 'star'],
                'Horror': ['horror', 'ghost', 'dark', 'fear', 'nightmare', 'haunted', 'terror', 'vampire', 'zombie', 'evil'],
                'Biography/Memoir': ['life', 'biography', 'memoir', 'story of', 'autobiography', 'true story', 'personal'],
                'History': ['history', 'war', 'historical', 'century', 'battle', 'ancient', 'civilization', 'world war'],
                'Children/Young Adult': ['children', 'kid', 'young', 'junior', 'teen', 'school', 'adventure', 'family'],
                'Business/Self-Help': ['business', 'success', 'leadership', 'management', 'entrepreneur', 'self-help', 'guide'],
                'Health/Fitness': ['health', 'fitness', 'diet', 'nutrition', 'exercise', 'wellness', 'medical']
            }
            
            # Apply genre classification using both title and author
            for genre, keywords in genre_keywords.items():
                for keyword in keywords:
                    title_mask = data['title'].str.contains(keyword, case=False, na=False)
                    author_mask = data['author'].str.contains(keyword, case=False, na=False)
                    combined_mask = title_mask | author_mask
                    data.loc[combined_mask, 'genre'] = genre
            
            # Create reading difficulty level
            data['reading_level'] = np.random.choice(['Beginner', 'Intermediate', 'Advanced'], 
                                                   size=len(data), p=[0.3, 0.5, 0.2])
            
            # Create popularity score
            data['popularity_score'] = (data['rating'] * 0.7 + 
                                      (data['user_ratings'] / data['user_ratings'].max()) * 100 * 0.3)
            
            # Create combined features for content-based filtering
            data['combined_features'] = (
                data['title'].fillna('') + ' ' + 
                data['author'].fillna('') + ' ' + 
                data['genre'].fillna('') + ' ' +
                data['publisher'].fillna('') + ' ' +
                data['reading_level'].fillna('')
            )
            
            print("🔧 Creating TF-IDF vectorizer...")
            # Create TF-IDF vectorizer with optimized parameters
            vectorizer = TfidfVectorizer(
                stop_words='english',
                max_features=8000,  # Increased for better recommendations
                ngram_range=(1, 3),
                min_df=2,
                max_df=0.95,
                lowercase=True,
                strip_accents='unicode'
            )
            
            book_features = vectorizer.fit_transform(data['combined_features'])
            print(f"📊 Created feature matrix with shape: {book_features.shape}")
            
            # Content-based model with optimized parameters
            print("🤖 Training content-based recommendation model...")
            content_model = NearestNeighbors(
                metric='cosine', 
                algorithm='brute', 
                n_neighbors=min(25, len(data))
            )
            content_model.fit(book_features)
            
            # Create collaborative filtering model
            print("🤝 Creating collaborative filtering model...")
            try:
                # Create user-item matrix for collaborative filtering
                n_users = min(1000, len(data))  # Limit users for memory efficiency
                n_books = len(data)
                
                # Generate synthetic user-book interaction matrix
                np.random.seed(42)
                user_book_ratings = np.random.choice([0, 1, 2, 3, 4, 5], 
                                                   size=(n_users, n_books), 
                                                   p=[0.7, 0.05, 0.05, 0.1, 0.05, 0.05])
                
                user_item_matrix = csr_matrix(user_book_ratings)
                
                # Use SVD for dimensionality reduction
                if user_item_matrix.shape[0] > 50 and user_item_matrix.shape[1] > 50:
                    collaborative_model = TruncatedSVD(n_components=min(50, min(user_item_matrix.shape) - 1), 
                                                     random_state=42)
                    collaborative_model.fit(user_item_matrix)
                    print("✅ Collaborative filtering model created successfully!")
                else:
                    print("⚠️ Dataset too small for collaborative filtering")
                    collaborative_model = None
                    
            except Exception as e:
                print(f"⚠️ Warning: Could not create collaborative filtering model: {e}")
                collaborative_model = None
                user_item_matrix = None
            
            _data_loaded = True
            _data_loading = False
            total_time = time.time() - start_time
            print(f"✅ LAZY LOADING: All models loaded successfully in {total_time:.2f}s!")
            
            return True
            
        except Exception as e:
            print(f"❌ LAZY LOADING ERROR: {e}")
            import traceback
            traceback.print_exc()
            _data_loading = False
            return False

def extract_key_words(text, genre):
    """Extract key thematic words from text"""
    if not text:
        return []
    
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    
    # Genre-specific important words
    genre_keywords = {
        'Fantasy': ['magic', 'wizard', 'dragon', 'kingdom', 'quest', 'sword', 'castle'],
        'Mystery': ['detective', 'murder', 'clue', 'investigation', 'mystery', 'crime', 'police'],
        'Romance': ['love', 'heart', 'passion', 'wedding', 'relationship', 'kiss', 'romantic'],
        'Science Fiction': ['future', 'space', 'alien', 'technology', 'robot', 'galaxy', 'mars'],
        'Horror': ['horror', 'ghost', 'dark', 'fear', 'nightmare', 'haunted', 'terror'],
        'Adventure': ['adventure', 'journey', 'explore', 'treasure', 'hero', 'quest', 'danger']
    }
    
    # Filter relevant words
    relevant_words = []
    for word in words:
        if len(word) > 3 and word not in ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'with', 'that', 'this']:
            relevant_words.append(word)
    
    # Add genre-specific keywords if they appear in text
    if genre in genre_keywords:
        relevant_words.extend([kw for kw in genre_keywords[genre] if kw in text.lower()])
    
    # Return most frequent/relevant words
    word_counts = Counter(relevant_words)
    return [word for word, count in word_counts.most_common(10)]

def generate_recommendation_factors(method, similarity_score=None, genre=None):
    """Generate recommendation factors for Recharts visualization"""
    factors = []
    
    if method == 'genre':
        factors = [
            {'factor': 'Genre Match', 'score': 85},
            {'factor': 'Content Similarity', 'score': 72},
            {'factor': 'User Preference', 'score': 68},
            {'factor': 'Rating Pattern', 'score': 75}
        ]
    elif method == 'author':
        factors = [
            {'factor': 'Author Match', 'score': 90},
            {'factor': 'Writing Style', 'score': 78},
            {'factor': 'Genre Similarity', 'score': 65},
            {'factor': 'Publication Era', 'score': 70}
        ]
    elif method == 'collaborative':
        factors = [
            {'factor': 'User Similarity', 'score': 88},
            {'factor': 'Rating Patterns', 'score': 82},
            {'factor': 'Preference Match', 'score': 75},
            {'factor': 'Social Filtering', 'score': 70}
        ]
    elif method == 'hybrid':
        factors = [
            {'factor': 'Content Match', 'score': 85},
            {'factor': 'Collaborative Filter', 'score': 80},
            {'factor': 'Popularity Score', 'score': 75},
            {'factor': 'User History', 'score': 70}
        ]
    else:  # content-based
        base_score = int((similarity_score or 0.75) * 100)
        factors = [
            {'factor': 'Content Match', 'score': base_score},
            {'factor': 'Genre Similarity', 'score': max(50, base_score - 10)},
            {'factor': 'User Preference', 'score': max(45, base_score - 20)},
            {'factor': 'Collaborative Filter', 'score': max(40, base_score - 30)}
        ]
    
    return factors

def get_book_image_url(book_row):
    """Get the best available image URL for a book"""
    # Try different image URL columns in order of preference
    image_columns = ['image_large', 'image', 'image_small']
    
    for col in image_columns:
        if col in book_row and pd.notna(book_row[col]) and str(book_row[col]).lower() not in ['nan', '', 'null']:
            return str(book_row[col])
    
    # Fallback to placeholder
    title = str(book_row.get('title', 'Book'))[:20].replace(' ', '+')
    return f"https://via.placeholder.com/200x300/4a5568/ffffff?text={title}"

def recommend(choice, method='content', user_id=None, limit=8):
    """Enhanced recommendation algorithm with multiple methods"""
    global data, content_model, book_features, collaborative_model, user_item_matrix
    
    # LAZY LOADING: Load data only when needed
    if not load_data_and_models():
        return {'error': 'Models are loading, please try again in a moment', 'loading': True}
    
    if not choice or not choice.strip():
        # Return popular books when no specific choice is given
        popular_books = data.nlargest(limit, 'popularity_score')
        return format_book_recommendations(popular_books, 'popular', 0.8)
    
    choice = choice.strip()
    print(f"🔍 Searching for: '{choice}' using method: {method}")
    
    try:
        choice_index = None
        search_score = 0
        
        # Enhanced search logic with fuzzy matching
        # Try exact match first
        exact_match = data[data['title'].str.lower() == choice.lower()]
        if not exact_match.empty:
            choice_index = exact_match.index[0]
            search_score = 1.0
            print(f"✅ Found exact match: {exact_match.iloc[0]['title']}")
        else:
            # Try partial match with different strategies
            partial_matches = data[data['title'].str.contains(choice, case=False, na=False)]
            if not partial_matches.empty:
                # Sort by similarity and take the best match
                best_match = partial_matches.iloc[0]
                choice_index = best_match.name
                search_score = 0.8
                print(f"✅ Found partial match: {best_match['title']}")
            else:
                # Try author search
                author_matches = data[data['author'].str.contains(choice, case=False, na=False)]
                if not author_matches.empty:
                    choice_index = author_matches.index[0]
                    search_score = 0.6
                    print(f"✅ Found author match: {author_matches.iloc[0]['title']}")
                else:
                    # Try genre search
                    genre_matches = data[data['genre'].str.contains(choice, case=False, na=False)]
                    if not genre_matches.empty:
                        choice_index = genre_matches.index[0]
                        search_score = 0.4
                        print(f"✅ Found genre match: {genre_matches.iloc[0]['title']}")
        
        # Fallback to popular books if no match found
        if choice_index is None:
            print(f"❌ No matches found for: '{choice}', returning popular books")
            popular = data.nlargest(limit, 'popularity_score')
            return format_book_recommendations(popular, 'popular', 0.7)
        
        # Get recommendations based on the chosen method
        if method == 'collaborative' and collaborative_model is not None:
            recommendations = get_collaborative_recommendations(choice_index, limit)
        elif method == 'hybrid':
            recommendations = get_hybrid_recommendations(choice_index, limit, user_id)
        else:
            # Default to content-based
            recommendations = get_content_based_recommendations(choice_index, limit, search_score)
            
        return recommendations
        
    except Exception as e:
        print(f"❌ Error in recommend: {e}")
        import traceback
        traceback.print_exc()
        # Return popular books as fallback
        popular = data.nlargest(limit, 'popularity_score')
        return format_book_recommendations(popular, 'fallback', 0.5)

def get_content_based_recommendations(choice_index, limit, search_score):
    """Get content-based recommendations using ML similarity"""
    try:
        # Get similar books using ML model
        distances, indices = content_model.kneighbors(
            book_features[choice_index], 
            n_neighbors=min(limit + 5, len(data))
        )
        
        book_list = []
        
        for i, idx in enumerate(indices.flatten()):
            if idx != choice_index:
                book_data = data.iloc[idx]
                similarity_score = 1 - distances[0][i]
                
                # Boost similarity score based on search quality
                adjusted_similarity = similarity_score * search_score
                
                book_dict = create_book_dict(book_data, adjusted_similarity, 'content')
                book_list.append(book_dict)
        
        # Sort by similarity and return top results
        book_list.sort(key=lambda x: x['similarity'], reverse=True)
        return book_list[:limit]
        
    except Exception as e:
        print(f"❌ Error in content-based recommendations: {e}")
        return []

def get_collaborative_recommendations(choice_index, limit):
    """Get collaborative filtering recommendations"""
    try:
        if collaborative_model is None or user_item_matrix is None:
            return get_content_based_recommendations(choice_index, limit, 1.0)
        
        # Transform the user-item matrix
        user_factors = collaborative_model.transform(user_item_matrix)
        
        # Find similar users based on the book choice
        book_vector = user_item_matrix[:, choice_index].toarray().flatten()
        user_similarities = np.dot(user_factors, user_factors.T)
        
        # Get top similar users
        similar_users = np.argsort(user_similarities[0])[::-1][:50]
        
        # Get books liked by similar users
        recommended_books = []
        for user_idx in similar_users:
            user_ratings = user_item_matrix[user_idx].toarray().flatten()
            top_books = np.argsort(user_ratings)[::-1][:limit]
            recommended_books.extend(top_books)
        
        # Remove duplicates and the original book
        recommended_books = list(set(recommended_books))
        if choice_index in recommended_books:
            recommended_books.remove(choice_index)
        
        # Format recommendations
        recommendations = []
        for book_idx in recommended_books[:limit]:
            book_data = data.iloc[book_idx]
            book_dict = create_book_dict(book_data, 0.85, 'collaborative')
            recommendations.append(book_dict)
        
        return recommendations
        
    except Exception as e:
        print(f"❌ Error in collaborative recommendations: {e}")
        return get_content_based_recommendations(choice_index, limit, 1.0)

def get_hybrid_recommendations(choice_index, limit, user_id=None):
    """Get hybrid recommendations combining multiple methods"""
    try:
        # Get content-based recommendations
        content_recs = get_content_based_recommendations(choice_index, limit // 2, 1.0)
        
        # Get collaborative recommendations if available
        collab_recs = []
        if collaborative_model is not None:
            collab_recs = get_collaborative_recommendations(choice_index, limit // 2)
        
        # Combine and deduplicate
        all_recs = content_recs + collab_recs
        seen_titles = set()
        unique_recs = []
        
        for rec in all_recs:
            if rec['title'] not in seen_titles:
                rec['method'] = 'hybrid'
                rec['recommendationFactors'] = generate_recommendation_factors('hybrid')
                unique_recs.append(rec)
                seen_titles.add(rec['title'])
        
        return unique_recs[:limit]
        
    except Exception as e:
        print(f"❌ Error in hybrid recommendations: {e}")
        return get_content_based_recommendations(choice_index, limit, 1.0)

def create_book_dict(book_data, similarity_score, method):
    """Create standardized book dictionary for API response"""
    keywords = extract_key_words(book_data.get('title', ''), book_data.get('genre', ''))
    
    return {
        'title': str(book_data['title']),
        'author': str(book_data.get('author', 'Unknown')),
        'rating': float(book_data.get('rating', 0)),
        'image': get_book_image_url(book_data),
        'similarity': float(similarity_score),
        'genre': str(book_data.get('genre', 'General')),
        'method': method,
        'year': int(book_data.get('year', 2000)),
        'publisher': str(book_data.get('publisher', 'Unknown')),
        'popularity_score': float(book_data.get('popularity_score', 0)),
        'reading_level': str(book_data.get('reading_level', 'Intermediate')),
        'recommendationReason': get_recommendation_reason(method, book_data.get('genre', '')),
        'keywords': keywords[:5],
        'recommendationFactors': generate_recommendation_factors(method, similarity_score)
    }

def format_book_recommendations(books_df, method, base_similarity):
    """Format a DataFrame of books into recommendation format"""
    recommendations = []
    
    for _, book in books_df.iterrows():
        book_dict = create_book_dict(book, base_similarity, method)
        recommendations.append(book_dict)
    
    return recommendations

def get_recommendation_reason(method, genre):
    """Get appropriate recommendation reason based on method"""
    reasons = {
        'content': f"Similar themes and writing style",
        'collaborative': f"Liked by users with similar tastes",
        'genre': f"Matches your interest in {genre} books",
        'author': f"By the same author you searched for",
        'popular': f"Popular choice among readers",
        'hybrid': f"Recommended based on multiple factors",
        'fallback': f"Highly rated book you might enjoy"
    }
    return reasons.get(method, "Recommended for you")

def get_genre_based_recommendations(genre, n_recommendations=10):
    """Get recommendations based on genre with enhanced features"""
    try:
        if not load_data_and_models():
            return {'error': 'Models loading', 'loading': True}
        
        decoded_genre = unquote(genre)
        print(f"🎭 Getting recommendations for genre: '{decoded_genre}'")
        
        # Filter books by genre with fallback logic
        genre_books = data[data['genre'].str.contains(decoded_genre, case=False, na=False)]
        
        if genre_books.empty:
            # Try splitting genre and matching parts
            genre_parts = decoded_genre.split('/')
            for part in genre_parts:
                if part.strip():
                    genre_books = data[data['genre'].str.contains(part.strip(), case=False, na=False)]
                    if not genre_books.empty:
                        break
        
        if genre_books.empty:
            return []
        
        # Sort by popularity score and rating
        top_books = genre_books.nlargest(n_recommendations, ['popularity_score', 'rating'])
        
        recommendations = []
        for _, book in top_books.iterrows():
            book_dict = create_book_dict(book, 0.85, 'genre')
            book_dict['recommendationReason'] = f"Top-rated book in {decoded_genre}"
            recommendations.append(book_dict)
        
        return recommendations
    
    except Exception as e:
        print(f"❌ Genre-based recommendation error: {e}")
        return []

def get_author_based_recommendations(author, n_recommendations=10):
    """Get recommendations based on author with enhanced features"""
    try:
        if not load_data_and_models():
            return {'error': 'Models loading', 'loading': True}
        
        decoded_author = unquote(author)
        print(f"✍️ Getting books by author: {decoded_author}")
        
        # Find books by the author with fuzzy matching
        author_books = data[data['author'].str.contains(decoded_author, case=False, na=False)]
        
        if author_books.empty:
            return []
        
        # Sort by rating and popularity
        top_books = author_books.nlargest(n_recommendations, ['rating', 'popularity_score'])
        
        recommendations = []
        for _, book in top_books.iterrows():
            book_dict = create_book_dict(book, 0.90, 'author')
            book_dict['recommendationReason'] = f"By {book['author']}"
            recommendations.append(book_dict)
        
        return recommendations
    
    except Exception as e:
        print(f"❌ Author-based recommendation error: {e}")
        return []

def fetch_book_details_from_google(book_title):
    """Fetch detailed book information from Google Books API"""
    try:
        print(f"📖 Fetching Google Books details for: {book_title}")
        
        # Clean the book title for better search results
        clean_title = book_title.replace(' (', '').replace(')', '').strip()
        
        # Google Books API endpoint
        api_url = "https://www.googleapis.com/books/v1/volumes"
        params = {
            'q': f'intitle:"{clean_title}"',
            'maxResults': 5,
            'printType': 'books'
        }
        
        # Add API key if available
        google_api_key = os.getenv('GOOGLE_BOOKS_API_KEY')
        if google_api_key:
            params['key'] = google_api_key
        
        response = requests.get(api_url, params=params, timeout=10)
        
        if response.status_code == 200:
            api_data = response.json()
            
            if 'items' in api_data and len(api_data['items']) > 0:
                # Find the best match
                best_match = None
                best_score = 0
                
                for item in api_data['items']:
                    volume_info = item.get('volumeInfo', {})
                    title = volume_info.get('title', '').lower()
                    clean_search_title = clean_title.lower()
                    
                    # Simple similarity check
                    if clean_search_title in title or title in clean_search_title:
                        score = len(set(clean_search_title.split()) & set(title.split()))
                        if score > best_score:
                            best_score = score
                            best_match = volume_info
                
                # Use first result if no good match found
                if not best_match:
                    best_match = api_data['items'][0].get('volumeInfo', {})
                
                # Extract book details
                book_details = {
                    'title': best_match.get('title', 'Unknown Title'),
                    'authors': best_match.get('authors', ['Unknown Author']),
                    'description': best_match.get('description', 'No description available'),
                    'averageRating': best_match.get('averageRating'),
                    'ratingsCount': best_match.get('ratingsCount'),
                    'pageCount': best_match.get('pageCount'),
                    'publishedDate': best_match.get('publishedDate'),
                    'publisher': best_match.get('publisher'),
                    'categories': best_match.get('categories', []),
                    'language': best_match.get('language'),
                    'previewLink': best_match.get('previewLink'),
                    'infoLink': best_match.get('infoLink'),
                    'source': 'Google Books API'
                }
                
                # Handle image links
                image_links = best_match.get('imageLinks', {})
                if image_links:
                    # Use the largest available image
                    for size in ['large', 'medium', 'small', 'thumbnail', 'smallThumbnail']:
                        if size in image_links:
                            book_details['imageLinks'] = {'thumbnail': image_links[size]}
                            break
                
                # Industry identifiers (ISBN, etc.)
                industry_identifiers = best_match.get('industryIdentifiers', [])
                for identifier in industry_identifiers:
                    if identifier.get('type') == 'ISBN_13':
                        book_details['isbn'] = identifier.get('identifier')
                        break
                
                print(f"✅ Found Google Books details for: {book_details['title']}")
                return book_details
            else:
                print(f"❌ No books found in Google Books for: {book_title}")
                return None
        else:
            print(f"❌ Google Books API request failed with status: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Error fetching from Google Books for {book_title}: {e}")
        return None

def fetch_book_details_combined(book_title):
    """Try to fetch book details from multiple sources"""
    print(f"🔍 Fetching book details for: {book_title}")
    
    # Try our local database first
    if load_data_and_models():
        local_book = data[data['title'].str.lower() == book_title.lower()]
        if not local_book.empty:
            book = local_book.iloc[0]
            local_details = {
                'title': str(book['title']),
                'authors': [str(book['author'])],
                'description': f"A {book['genre']} book by {book['author']}. Published by {book['publisher']} in {book['year']}.",
                'averageRating': float(book['rating']),
                'ratingsCount': int(book.get('user_ratings', 100)),
                'publishedDate': str(book['year']),
                'publisher': str(book['publisher']),
                'categories': [str(book['genre'])],
                'readingLevel': str(book.get('reading_level', 'Intermediate')),
                'popularityScore': float(book.get('popularity_score', 0)),
                'source': 'BookQuest Database'
            }
            
            # Try to enhance with Google Books data
            google_details = fetch_book_details_from_google(book_title)
            if google_details:
                # Merge local and Google data
                local_details.update({
                    'description': google_details.get('description', local_details['description']),
                    'pageCount': google_details.get('pageCount'),
                    'language': google_details.get('language'),
                    'previewLink': google_details.get('previewLink'),
                    'infoLink': google_details.get('infoLink'),
                    'imageLinks': google_details.get('imageLinks')
                })
            
            return local_details
    
    # Try Google Books API as fallback
    google_details = fetch_book_details_from_google(book_title)
    if google_details:
        return google_details
    
    # If all fails, return error
    return {
        'error': f'No book details found for "{book_title}" in any database.',
        'title': book_title,
        'message': 'The book may not be available in our databases.'
    }

# --- AUTHENTICATION ROUTES ---

@app.route('/api/auth/signup', methods=['POST', 'OPTIONS'])
@cross_origin()
def signup():
    """Enhanced user registration endpoint"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    try:
        data_req = request.get_json()
        username = data_req.get('username', '').strip()
        email = data_req.get('email', '').strip()
        password = data_req.get('password', '').strip()
        
        # Enhanced validation
        if not username or len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
        
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({'error': 'Username can only contain letters, numbers, and underscores'}), 400
        
        if not email or '@' not in email or '.' not in email.split('@')[1]:
            return jsonify({'error': 'Valid email is required'}), 400
        
        if not password or len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long'}), 400
        
        with get_db_connection() as conn:
            # Check if user already exists
            existing_user = conn.execute(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                (username, email)
            ).fetchone()
            
            if existing_user:
                return jsonify({'error': 'Username or email already exists'}), 409
            
            # Create new user
            password_hash = generate_password_hash(password)
            cursor = conn.execute(
                'INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
                (username, email, password_hash, get_current_timestamp())
            )
            user_id = cursor.lastrowid
            conn.commit()
            
            # Generate token
            token = generate_auth_token(user_id, username)
            
            print(f"✅ New user registered: {username}")
            return jsonify({
                'message': 'Account created successfully',
                'token': token,
                'user': {
                    'id': user_id,
                    'username': username,
                    'email': email
                }
            }), 201
            
    except Exception as e:
        print(f"❌ Signup error: {e}")
        return jsonify({'error': 'Failed to create account'}), 500

@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
@cross_origin()
def login():
    """Enhanced user login endpoint"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    try:
        data_req = request.get_json()
        username_or_email = data_req.get('username', '').strip()
        password = data_req.get('password', '').strip()
        
        if not username_or_email or not password:
            return jsonify({'error': 'Username/email and password are required'}), 400
        
        with get_db_connection() as conn:
            # Find user by username or email
            user = conn.execute(
                'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?',
                (username_or_email, username_or_email)
            ).fetchone()
            
            if not user or not check_password_hash(user[3], password):
                return jsonify({'error': 'Invalid credentials'}), 401
            
            # Generate token
            token = generate_auth_token(user[0], user[1])
            
            # Log session start
            conn.execute(
                'INSERT INTO user_sessions (user_id, session_start) VALUES (?, ?)',
                (user[0], get_current_timestamp())
            )
            conn.commit()
            
            print(f"✅ User logged in: {user[1]}")
            return jsonify({
                'message': 'Login successful',
                'token': token,
                'user': {
                    'id': user[0],
                    'username': user[1],
                    'email': user[2]
                }
            }), 200
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500

@app.route('/api/auth/verify', methods=['GET', 'OPTIONS'])
@cross_origin()
@auth_required
def verify_token():
    """Verify if user token is valid"""
    return jsonify({
        'valid': True,
        'user': {
            'id': request.current_user['user_id'],
            'username': request.current_user['username']
        }
    }), 200

@app.route('/api/auth/logout', methods=['POST', 'OPTIONS'])
@cross_origin()
def logout():
    """User logout endpoint"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    return jsonify({'message': 'Logged out successfully'}), 200

# --- API ROUTES ---

@app.route('/api/health')
@cross_origin()
def health():
    """Enhanced health check endpoint"""
    try:
        return jsonify({
            'status': 'healthy' if _data_loaded else 'ready',
            'model_loaded': _data_loaded,
            'data_loading': _data_loading,
            'timestamp': get_current_timestamp(),
            'data_size': len(data) if data is not None else 0,
            'features': {
                'content_based': content_model is not None,
                'collaborative_filtering': collaborative_model is not None,
                'google_books_api': bool(os.getenv('GOOGLE_BOOKS_API_KEY')),
                'user_authentication': True,
                'analytics': True
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': get_current_timestamp()
        }), 500

@app.route('/api/recommend')
@cross_origin()
def api_recommend():
    """Enhanced book recommendations with multiple methods"""
    query = request.args.get('q', '')
    method = request.args.get('method', 'content')  # content, collaborative, hybrid
    limit = min(int(request.args.get('limit', 8)), 20)  # Max 20 recommendations
    
    print(f"🔍 Recommendation request: '{query}' (method: {method}, limit: {limit})")
    
    if not query:
        return jsonify({
            'error': 'No query provided',
            'query': '',
            'recommendations': [],
            'count': 0
        }), 400
    
    try:
        # Get user ID if authenticated
        user_id = None
        token = request.headers.get('Authorization')
        if token and token.startswith('Bearer '):
            user_info = verify_auth_token(token[7:])
            if user_info:
                user_id = user_info['user_id']
        
        recommendations = recommend(query, method, user_id, limit)
        
        # Handle loading state
        if isinstance(recommendations, dict) and 'loading' in recommendations:
            return jsonify({
                'loading': True,
                'message': 'Models are loading, please try again in a moment',
                'query': query,
                'recommendations': [],
                'count': 0
            }), 202  # 202 Accepted - processing
        
        print(f"✅ Found {len(recommendations)} recommendations")
        
        # Log search analytics
        try:
            with get_db_connection() as conn:
                conn.execute(
                    'INSERT INTO searches (query, timestamp, results_count) VALUES (?, ?, ?)',
                    (query, get_current_timestamp(), len(recommendations))
                )
                conn.commit()
        except Exception as e:
            print(f"⚠️ Error logging search: {e}")
        
        return jsonify({
            'query': query,
            'method': method,
            'recommendations': recommendations,
            'count': len(recommendations)
        })
        
    except Exception as e:
        print(f"❌ Error in api_recommend: {e}")
        return jsonify({
            'error': str(e),
            'query': query,
            'recommendations': [],
            'count': 0
        }), 500

@app.route('/api/book/<path:book_title>')
@cross_origin()
def get_book_details(book_title):
    """Get detailed book information from multiple sources"""
    print(f"📖 Getting details for: {book_title}")
    
    try:
        book_details = fetch_book_details_combined(book_title)
        
        # Log book view analytics
        try:
            with get_db_connection() as conn:
                conn.execute(
                    '''INSERT OR REPLACE INTO book_analytics 
                       (book_title, view_count, last_accessed) 
                       VALUES (?, COALESCE((SELECT view_count FROM book_analytics WHERE book_title = ?) + 1, 1), ?)''',
                    (book_title, book_title, get_current_timestamp())
                )
                conn.commit()
        except Exception as e:
            print(f"⚠️ Error logging book analytics: {e}")
        
        return jsonify(book_details)
        
    except Exception as e:
        print(f"❌ Error getting book details: {e}")
        return jsonify({
            'error': f'Failed to fetch book details: {str(e)}',
            'title': book_title
        }), 500

@app.route('/api/recommend/genre/<path:genre>')  
@cross_origin()
def genre_recommend(genre):
    """Get recommendations by genre"""
    limit = min(int(request.args.get('limit', 12)), 20)
    print(f"🎭 Genre recommendation request for: {genre} (limit: {limit})")
    
    try:
        recommendations = get_genre_based_recommendations(genre, limit)
        
        # Handle loading state
        if isinstance(recommendations, dict) and 'loading' in recommendations:
            return jsonify({
                'loading': True,
                'message': 'Models are loading, please try again in a moment',
                'genre': unquote(genre),
                'recommendations': [],
                'count': 0
            }), 202
        
        decoded_genre = unquote(genre)
        
        return jsonify({
            'genre': decoded_genre,
            'recommendations': recommendations,
            'count': len(recommendations)
        })
    except Exception as e:
        print(f"❌ Error in genre_recommend: {e}")
        return jsonify({
            'genre': unquote(genre),
            'recommendations': [], 
            'count': 0,
            'error': str(e)
        }), 500

@app.route('/api/recommend/author/<path:author>') 
@cross_origin()
def author_recommend(author):
    """Get recommendations by author"""
    limit = min(int(request.args.get('limit', 12)), 20)
    print(f"✍️ Author recommendation request for: {author} (limit: {limit})")
    
    try:
        recommendations = get_author_based_recommendations(author, limit)
        
        # Handle loading state
        if isinstance(recommendations, dict) and 'loading' in recommendations:
            return jsonify({
                'loading': True,
                'message': 'Models are loading, please try again in a moment',
                'author': unquote(author),
                'recommendations': [],
                'count': 0
            }), 202
        
        decoded_author = unquote(author)
        
        return jsonify({
            'author': decoded_author,
            'recommendations': recommendations,
            'count': len(recommendations)
        })
    except Exception as e:
        print(f"❌ Error in author_recommend: {e}")
        return jsonify({
            'author': unquote(author),
            'recommendations': [], 
            'count': 0,
            'error': str(e)
        }), 500

@app.route('/api/recommend/hybrid', methods=['POST', 'OPTIONS'])
@cross_origin()
def hybrid_recommend():
    """API endpoint for hybrid recommendations"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    try:
        request_data = request.get_json() if request.is_json else {}
        book_title = request_data.get('book_title', '')
        user_preferences = request_data.get('preferences', {})
        limit = min(int(request_data.get('limit', 8)), 20)
        
        # Get user ID if authenticated
        user_id = None
        token = request.headers.get('Authorization')
        if token and token.startswith('Bearer '):
            user_info = verify_auth_token(token[7:])
            if user_info:
                user_id = user_info['user_id']
        
        if book_title:
            recommendations = recommend(book_title, 'hybrid', user_id, limit)
            
            # Handle loading state
            if isinstance(recommendations, dict) and 'loading' in recommendations:
                return jsonify({
                    'loading': True,
                    'message': 'Models are loading, please try again in a moment',
                    'recommendations': [],
                    'count': 0
                }), 202
            
            return jsonify({
                'recommendations': recommendations,
                'count': len(recommendations),
                'method': 'hybrid'
            })
        else:
            return jsonify({
                'recommendations': [],
                'count': 0,
                'error': 'No search parameters provided'
            })
    
    except Exception as e:
        print(f"❌ Error in hybrid_recommend: {e}")
        return jsonify({'error': str(e), 'recommendations': [], 'count': 0}), 500

@app.route('/api/genres')
@cross_origin()
def get_genres():
    """Get all available genres"""
    try:
        if not load_data_and_models():
            return jsonify({'loading': True, 'genres': []}), 202
        
        if data is not None and 'genre' in data.columns:
            # Get genres with their counts
            genre_counts = data['genre'].value_counts()
            genres = []
            
            for genre, count in genre_counts.items():
                if str(genre).strip() and count > 5:  # Only include genres with at least 5 books
                    genres.append({
                        'name': str(genre).strip(),
                        'count': int(count),
                        'popularity': min(100, int(count / 10))  # Normalized popularity score
                    })
            
            # Sort by popularity
            genres.sort(key=lambda x: x['count'], reverse=True)
            
            return jsonify({
                'genres': genres,
                'total_genres': len(genres)
            })
        
        # Fallback genres with estimated counts
        fallback_genres = [
            {'name': 'Mystery/Thriller', 'count': 150, 'popularity': 90},
            {'name': 'Romance', 'count': 120, 'popularity': 85},
            {'name': 'Fantasy', 'count': 100, 'popularity': 80},
            {'name': 'Science Fiction', 'count': 90, 'popularity': 75},
            {'name': 'Horror', 'count': 80, 'popularity': 70},
            {'name': 'Biography/Memoir', 'count': 70, 'popularity': 65},
            {'name': 'History', 'count': 60, 'popularity': 60},
            {'name': 'Children/Young Adult', 'count': 110, 'popularity': 88},
            {'name': 'General Fiction', 'count': 200, 'popularity': 95}
        ]
        return jsonify({
            'genres': fallback_genres,
            'total_genres': len(fallback_genres)
        })
        
    except Exception as e:
        print(f"❌ Error getting genres: {e}")
        return jsonify({'genres': [], 'total_genres': 0}), 500

@app.route('/api/authors')
@cross_origin()
def get_authors():
    """Get popular authors with their book counts"""
    try:
        if not load_data_and_models():
            return jsonify({'loading': True, 'authors': []}), 202
        
        if data is not None and 'author' in data.columns:
            # Get top authors by book count
            author_counts = data['author'].value_counts()
            authors = []
            
            for author, count in author_counts.head(50).items():  # Top 50 authors
                if str(author).strip() and str(author) != 'Unknown' and count > 2:
                    # Get average rating for this author
                    author_books = data[data['author'] == author]
                    avg_rating = author_books['rating'].mean()
                    
                    authors.append({
                        'name': str(author).strip(),
                        'book_count': int(count),
                        'average_rating': round(float(avg_rating), 1),
                        'genres': list(author_books['genre'].unique()[:3])  # Top 3 genres
                    })
            
            # Sort by book count
            authors.sort(key=lambda x: x['book_count'], reverse=True)
            
            return jsonify({
                'authors': authors,
                'total_authors': len(authors)
            })
        
        return jsonify({'authors': [], 'total_authors': 0})
        
    except Exception as e:
        print(f"❌ Error getting authors: {e}")
        return jsonify({'authors': [], 'total_authors': 0}), 500

@app.route('/api/popular')
@cross_origin()
def get_popular_books():
    """Get popular books with enhanced metadata"""
    try:
        if not load_data_and_models():
            return jsonify({'loading': True, 'books': []}), 202
        
        limit = min(int(request.args.get('limit', 20)), 50)
        sort_by = request.args.get('sort', 'popularity')  # popularity, rating, recent
        
        if sort_by == 'rating':
            popular_books = data.nlargest(limit, 'rating')
        elif sort_by == 'recent':
            popular_books = data.nlargest(limit, 'year')
        else:
            popular_books = data.nlargest(limit, 'popularity_score')
        
        books = format_book_recommendations(popular_books, 'popular', 0.8)
        
        return jsonify({
            'books': books,
            'count': len(books),
            'sort_by': sort_by
        })
        
    except Exception as e:
        print(f"❌ Error getting popular books: {e}")
        return jsonify({'books': [], 'count': 0}), 500

# PROTECTED ROUTES - Require authentication

@app.route('/api/favorites', methods=['POST', 'GET', 'DELETE', 'OPTIONS'])
@cross_origin()
def handle_favorites():
    """Enhanced favorites management"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
        
    try:
        # Check for authentication token
        token = request.headers.get('Authorization')
        user_id = None
        
        if token:
            if token.startswith('Bearer '):
                token = token[7:]
            user_info = verify_auth_token(token)
            if user_info:
                user_id = user_info['user_id']
        
        if request.method == 'POST':
            if not user_id:
                return jsonify({'error': 'Authentication required'}), 401
                
            data_req = request.json
            title = data_req.get('title')
            author = data_req.get('author', '')
            image = data_req.get('image', '')
            genre = data_req.get('genre', '')
            rating = data_req.get('rating', 0)
            
            with get_db_connection() as conn:
                # Check if already in favorites
                existing = conn.execute(
                    'SELECT id FROM favorites WHERE book_title = ? AND user_id = ?',
                    (title, user_id)
                ).fetchone()
                
                if existing:
                    return jsonify({'error': 'Book already in favorites'}), 409
                
                conn.execute(
                    '''INSERT INTO favorites 
                       (book_title, book_author, book_image, timestamp, user_id) 
                       VALUES (?, ?, ?, ?, ?)''',
                    (title, author, image, get_current_timestamp(), user_id)
                )
                conn.commit()
            
            return jsonify({'success': True, 'message': 'Added to favorites'})
            
        elif request.method == 'DELETE':
            if not user_id:
                return jsonify({'error': 'Authentication required'}), 401
                
            title = request.args.get('title')
            
            with get_db_connection() as conn:
                result = conn.execute(
                    'DELETE FROM favorites WHERE book_title = ? AND user_id = ?', 
                    (title, user_id)
                )
                conn.commit()
                
                if result.rowcount == 0:
                    return jsonify({'error': 'Book not found in favorites'}), 404
            
            return jsonify({'success': True, 'message': 'Removed from favorites'})
            
        elif request.method == 'GET':
            if not user_id:
                return jsonify([])  # Return empty array for unauthenticated users
            
            limit = min(int(request.args.get('limit', 50)), 100)
            
            with get_db_connection() as conn:
                cursor = conn.execute(
                    '''SELECT book_title, book_author, book_image, timestamp 
                       FROM favorites 
                       WHERE user_id = ? 
                       ORDER BY timestamp DESC 
                       LIMIT ?''',
                    (user_id, limit)
                )
                favorites = [
                    {
                        'title': row[0], 
                        'author': row[1], 
                        'image': row[2],
                        'added_date': row[3]
                    }
                    for row in cursor.fetchall()
                ]
            
            return jsonify({
                'favorites': favorites,
                'count': len(favorites)
            })
            
    except Exception as e:
        print(f"❌ Error in handle_favorites: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/rate', methods=['POST', 'OPTIONS'])
@cross_origin()
@auth_required
def rate_book():
    """Enhanced book rating system"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
        
    try:
        user_id = request.current_user['user_id']
        data_req = request.json
        title = data_req.get('title')
        rating = data_req.get('rating')
        review = data_req.get('review', '')
        
        # Validate rating
        if not isinstance(rating, (int, float)) or rating < 1 or rating > 5:
            return jsonify({'error': 'Rating must be between 1 and 5'}), 400
        
        with get_db_connection() as conn:
            # Check if user has already rated this book
            existing = conn.execute(
                'SELECT id FROM ratings WHERE book_title = ? AND user_id = ?',
                (title, user_id)
            ).fetchone()
            
            if existing:
                # Update existing rating
                conn.execute(
                    'UPDATE ratings SET rating = ?, timestamp = ? WHERE id = ?',
                    (rating, get_current_timestamp(), existing[0])
                )
                message = 'Rating updated successfully'
            else:
                # Insert new rating
                conn.execute(
                    'INSERT INTO ratings (book_title, rating, timestamp, user_id) VALUES (?, ?, ?, ?)',
                    (title, rating, get_current_timestamp(), user_id)
                )
                message = 'Rating saved successfully'
            
            conn.commit()
        
        return jsonify({'success': True, 'message': message})
    except Exception as e:
        print(f"❌ Error saving rating: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/analytics', methods=['GET'])
@cross_origin()
@auth_required
def get_analytics():
    """Get user analytics and reading statistics"""
    try:
        user_id = request.current_user['user_id']
        
        with get_db_connection() as conn:
            # Get user's favorite genres
            genre_stats = conn.execute(
                '''SELECT book_title, COUNT(*) as count 
                   FROM favorites 
                   WHERE user_id = ? 
                   GROUP BY book_title 
                   ORDER BY count DESC 
                   LIMIT 5''',
                (user_id,)
            ).fetchall()
            
            # Get user's reading activity
            activity = conn.execute(
                '''SELECT DATE(timestamp) as date, COUNT(*) as searches 
                   FROM searches 
                   WHERE user_id = ? 
                   GROUP BY DATE(timestamp) 
                   ORDER BY date DESC 
                   LIMIT 30''',
                (user_id,)
            ).fetchall() if 'user_id' in [desc[0] for desc in conn.execute('PRAGMA table_info(searches)').fetchall()] else []
            
            # Get total stats
            total_favorites = conn.execute(
                'SELECT COUNT(*) FROM favorites WHERE user_id = ?',
                (user_id,)
            ).fetchone()[0]
            
            total_ratings = conn.execute(
                'SELECT COUNT(*) FROM ratings WHERE user_id = ?',
                (user_id,)
            ).fetchone()[0]
        
        return jsonify({
            'user_stats': {
                'total_favorites': total_favorites,
                'total_ratings': total_ratings,
                'favorite_books': [{'book': row[0], 'count': row[1]} for row in genre_stats],
                'reading_activity': [{'date': row[0], 'searches': row[1]} for row in activity]
            }
        })
        
    except Exception as e:
        print(f"❌ Error getting analytics: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/search/suggestions')
@cross_origin()
def search_suggestions():
    """Get search suggestions based on partial input"""
    try:
        query = request.args.get('q', '').strip()
        limit = min(int(request.args.get('limit', 10)), 20)
        
        if len(query) < 2:
            return jsonify({'suggestions': []})
        
        if not load_data_and_models():
            return jsonify({'loading': True, 'suggestions': []}), 202
        
        # Get title suggestions
        title_matches = data[data['title'].str.contains(query, case=False, na=False)]['title'].head(limit//2).tolist()
        
        # Get author suggestions
        author_matches = data[data['author'].str.contains(query, case=False, na=False)]['author'].unique()[:limit//2].tolist()
        
        suggestions = []
        for title in title_matches:
            suggestions.append({
                'text': title,
                'type': 'title',
                'category': 'Books'
            })
        
        for author in author_matches:
            suggestions.append({
                'text': author,
                'type': 'author',
                'category': 'Authors'
            })
        
        return jsonify({
            'suggestions': suggestions[:limit],
            'count': len(suggestions[:limit])
        })
        
    except Exception as e:
        print(f"❌ Error getting suggestions: {e}")
        return jsonify({'suggestions': []})

# Initialize database
init_db()

# Production deployment configuration
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    print("🚀 Starting BookQuest backend with LAZY LOADING...")
    print("📊 Features: ML Recommendations, User Auth, Analytics, Google Books API")
    print("🔄 Models will load on first API request to prevent timeout")
    app.run(debug=False, host='0.0.0.0', port=port)
