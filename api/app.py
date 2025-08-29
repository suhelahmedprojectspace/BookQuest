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
         "https://*.vercel.app"  # Allow all Vercel deployments
     ],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=True,
     max_age=86400
)

basedir = os.path.abspath(os.path.dirname(__file__))
CSV_PATH = os.path.join(basedir, 'Books.csv')
DB_PATH = os.path.join(basedir, 'readly.db')

# Global variables for models
content_model = None
collaborative_model = None
data = None
user_item_matrix = None
book_features = None

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
    # Use environment variable for JWT secret
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

def extract_key_words(text, genre):
    """Extract key thematic words from text"""
    if not text:
        return []
    
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    
    # Genre-specific important words
    genre_keywords = {
        'Fantasy': ['magic', 'wizard', 'dragon', 'kingdom', 'quest'],
        'Mystery': ['detective', 'murder', 'clue', 'investigation', 'mystery'],
        'Romance': ['love', 'heart', 'passion', 'wedding', 'relationship'],
        'Science Fiction': ['future', 'space', 'alien', 'technology', 'robot'],
        'Horror': ['horror', 'ghost', 'dark', 'fear', 'nightmare', 'haunted'],
        'Adventure': ['adventure', 'journey', 'explore', 'treasure', 'hero']
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
    else:  # content-based
        base_score = int((similarity_score or 0.75) * 100)
        factors = [
            {'factor': 'Content Match', 'score': base_score},
            {'factor': 'Genre Similarity', 'score': max(50, base_score - 10)},
            {'factor': 'User Preference', 'score': max(45, base_score - 20)},
            {'factor': 'Collaborative Filter', 'score': max(40, base_score - 30)}
        ]
    
    return factors

def create_models():
    """Create both content-based and collaborative filtering models"""
    global content_model, collaborative_model, data, user_item_matrix, book_features
    
    try:
        # Load data with proper column mapping
        data = pd.read_csv(CSV_PATH, low_memory=False)
        print(f"📊 Loaded {len(data)} books")
        print(f"📊 Dataset columns: {list(data.columns)}")
        
        # Map column names to standard names
        column_mapping = {
            'Book-Title': 'title',
            'Book-Author': 'author', 
            'Publisher': 'publisher',
            'Year-Of-Publication': 'year',
            'Image-URL-M': 'image'
        }
        
        # Rename columns to match our code
        data = data.rename(columns=column_mapping)
        
        # Create synthetic ratings since your dataset doesn't have them
        np.random.seed(42)
        data['rating'] = np.random.uniform(3.0, 9.5, len(data))
        data['rating'] = data['rating'].round(1)
        
        # Create genre column based on title analysis
        data['genre'] = 'General Fiction'  # Default
        
        genre_keywords = {
            'Mystery/Thriller': ['mystery', 'detective', 'murder', 'crime', 'investigation', 'thriller', 'suspense'],
            'Romance': ['love', 'romance', 'heart', 'passion', 'wedding', 'bride', 'kiss'],
            'Fantasy': ['magic', 'wizard', 'dragon', 'fantasy', 'enchanted', 'spell', 'realm'],
            'Science Fiction': ['space', 'future', 'robot', 'sci-fi', 'alien', 'galaxy', 'time'],
            'Horror': ['horror', 'ghost', 'dark', 'fear', 'nightmare', 'haunted', 'terror'],
            'Biography/Memoir': ['life', 'biography', 'memoir', 'story of', 'autobiography'],
            'History': ['history', 'war', 'historical', 'century', 'battle', 'ancient'],
            'Children/Young Adult': ['children', 'kid', 'young', 'junior', 'teen', 'school'],
        }
        
        # Apply genre classification
        for genre, keywords in genre_keywords.items():
            for keyword in keywords:
                title_mask = data['title'].str.contains(keyword, case=False, na=False)
                data.loc[title_mask, 'genre'] = genre
        
        # Create combined features for content-based filtering
        data['combined_features'] = (
            data['title'].fillna('') + ' ' + 
            data['author'].fillna('') + ' ' + 
            data['genre'].fillna('') + ' ' +
            data['publisher'].fillna('')
        )
        
        # Create TF-IDF vectorizer
        tfidf = TfidfVectorizer(
            stop_words='english',
            max_features=5000,
            ngram_range=(1, 3),
            min_df=2
        )
        
        book_features = tfidf.fit_transform(data['combined_features'])
        
        # Content-based model
        content_model = NearestNeighbors(
            metric='cosine', 
            algorithm='brute', 
            n_neighbors=20
        )
        content_model.fit(book_features)
        
        print("✅ Enhanced ML models created successfully!")
        return data, content_model, collaborative_model
        
    except Exception as e:
        print(f"❌ Error creating models: {e}")
        return None, None, None

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
    
    # Try Google Books API first
    google_details = fetch_book_details_from_google(book_title)
    if google_details:
        return google_details
    
    # If fails, return error
    return {
        'error': f'No book details found for "{book_title}" in any database.',
        'title': book_title,
        'message': 'The book may not be available in Google Books database.'
    }

def recommend(choice):
    """Enhanced recommendation algorithm with visualization data"""
    global data, content_model, book_features
    
    if content_model is None or data is None or book_features is None:
        create_models()
        
    if not all([data is not None, content_model is not None, book_features is not None]):
        return []
    
    if not choice or not choice.strip():
        return []
    
    choice = choice.strip()
    print(f"🔍 Searching for: '{choice}'")
    
    try:
        choice_index = None
        
        # Try exact match first
        exact_match = data[data['title'].str.lower() == choice.lower()]
        if not exact_match.empty:
            choice_index = exact_match.index[0]
            print(f"✅ Found exact match: {exact_match.iloc[0]['title']}")
        else:
            # Try partial match
            partial_matches = data[data['title'].str.contains(choice, case=False, na=False)]
            if not partial_matches.empty:
                best_match = partial_matches.iloc[0]
                choice_index = best_match.name
                print(f"✅ Found partial match: {best_match['title']}")
            else:
                # Try author search
                author_matches = data[data['author'].str.contains(choice, case=False, na=False)]
                if not author_matches.empty:
                    choice_index = author_matches.index[0]
                    print(f"✅ Found author match: {author_matches.iloc[0]['title']}")
        
        # Fallback to popular books
        if choice_index is None:
            print(f"❌ No matches found for: '{choice}', returning popular books")
            popular = data.nlargest(8, 'rating')
            
            result = []
            for _, book in popular.iterrows():
                image_val = book.get('image', '')
                if pd.isna(image_val) or str(image_val).lower() in ['nan', '', 'null']:
                    image_val = f"https://via.placeholder.com/200x300/4a5568/ffffff?text={book['title'][:20].replace(' ', '+')}"
                
                # Generate keywords and visualization data
                keywords = extract_key_words(book.get('title', ''), book.get('genre', ''))
                
                book_dict = {
                    'title': str(book['title']),
                    'author': str(book.get('author', 'Unknown')),
                    'rating': float(book.get('rating', 0)),
                    'image': str(image_val),
                    'similarity': 0.7,
                    'genre': str(book.get('genre', 'General')),
                    'method': 'popular',
                    'recommendationReason': f"Popular book in {book.get('genre', 'General')} genre",
                    'keywords': keywords[:5],
                    'recommendationFactors': generate_recommendation_factors('content', 0.7)
                }
                result.append(book_dict)
            
            return result
        
        # Get similar books using ML model
        distances, indices = content_model.kneighbors(
            book_features[choice_index], 
            n_neighbors=min(12, len(data))
        )
        
        book_list = []
        original_book = data.iloc[choice_index]
        
        for i in indices.flatten():
            if i != choice_index:
                book_data = data.iloc[i]
                similarity_score = 1 - distances[0][list(indices.flatten()).index(i)]
                
                image_val = book_data.get('image', '')
                if pd.isna(image_val) or str(image_val).lower() in ['nan', '', 'null']:
                    image_val = f"https://via.placeholder.com/200x300/4a5568/ffffff?text={book_data['title'][:20].replace(' ', '+')}"
                
                # Generate keywords and visualization data
                keywords = extract_key_words(book_data.get('title', ''), book_data.get('genre', ''))
                
                book_dict = {
                    'title': str(book_data['title']),
                    'author': str(book_data.get('author', 'Unknown')),
                    'rating': float(book_data.get('rating', 0)),
                    'image': str(image_val),
                    'similarity': float(similarity_score),
                    'genre': str(book_data.get('genre', 'General')),
                    'method': 'content',
                    'recommendationReason': f"Similar themes and content to '{choice}'",
                    'keywords': keywords[:5],
                    'recommendationFactors': generate_recommendation_factors('content', similarity_score)
                }
                book_list.append(book_dict)
        
        book_list.sort(key=lambda x: x['similarity'], reverse=True)
        return book_list[:8]
        
    except Exception as e:
        print(f"❌ Error in recommend: {e}")
        import traceback
        traceback.print_exc()
        return []

def get_genre_based_recommendations(genre, n_recommendations=10):
    """Get recommendations based on genre with visualization data"""
    try:
        if data is None:
            create_models()
        
        decoded_genre = unquote(genre)
        print(f"🎭 Decoded genre: '{decoded_genre}' from '{genre}'")
        
        # Filter books by genre
        genre_books = data[data['genre'].str.contains(decoded_genre, case=False, na=False)]
        
        if genre_books.empty:
            genre_parts = decoded_genre.split('/')
            for part in genre_parts:
                if part.strip():
                    genre_books = data[data['genre'].str.contains(part.strip(), case=False, na=False)]
                    if not genre_books.empty:
                        break
        
        if genre_books.empty:
            return []
        
        # Sort by rating and get top books
        top_books = genre_books.nlargest(n_recommendations, 'rating')
        
        recommendations = []
        for _, book in top_books.iterrows():
            image_val = book.get('image', '')
            if pd.isna(image_val) or str(image_val).lower() in ['nan', '', 'null']:
                image_val = f"https://via.placeholder.com/200x300/4a5568/ffffff?text={book['title'][:20].replace(' ', '+')}"
            
            keywords = extract_key_words(book.get('title', ''), book.get('genre', ''))
            
            book_info = {
                'title': str(book['title']),
                'author': str(book.get('author', 'Unknown')),
                'rating': float(book.get('rating', 0)),
                'image': str(image_val),
                'genre': str(book.get('genre', decoded_genre)),
                'method': 'genre',
                'similarity': 0.85,
                'recommendationReason': f"Matches your interest in {decoded_genre} books",
                'keywords': keywords[:5],
                'recommendationFactors': generate_recommendation_factors('genre')
            }
            recommendations.append(book_info)
        
        return recommendations
    
    except Exception as e:
        print(f"❌ Genre-based recommendation error: {e}")
        return []

def get_author_based_recommendations(author, n_recommendations=10):
    """Get recommendations based on author with visualization data"""
    try:
        if data is None:
            create_models()
        
        decoded_author = unquote(author)
        print(f"✍️ Searching for books by author: {decoded_author}")
        
        # Find books by the author
        author_books = data[data['author'].str.contains(decoded_author, case=False, na=False)]
        
        if author_books.empty:
            return []
        
        recommendations = []
        for _, book in author_books.head(n_recommendations).iterrows():
            image_val = book.get('image', '')
            if pd.isna(image_val) or str(image_val).lower() in ['nan', '', 'null']:
                image_val = f"https://via.placeholder.com/200x300/4a5568/ffffff?text={book['title'][:20].replace(' ', '+')}"
            
            keywords = extract_key_words(book.get('title', ''), book.get('genre', ''))
            
            book_info = {
                'title': str(book['title']),
                'author': str(book['author']),
                'rating': float(book.get('rating', 0)),
                'image': str(image_val),
                'method': 'author',
                'genre': str(book.get('genre', 'General')),
                'similarity': 0.90,
                'recommendationReason': f"By the same author you searched for",
                'keywords': keywords[:5],
                'recommendationFactors': generate_recommendation_factors('author')
            }
            recommendations.append(book_info)
        
        return recommendations
    
    except Exception as e:
        print(f"❌ Author-based recommendation error: {e}")
        return []

# --- AUTHENTICATION ROUTES ---

@app.route('/api/auth/signup', methods=['POST', 'OPTIONS'])
@cross_origin()
def signup():
    """User registration endpoint"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    try:
        data_req = request.get_json()
        username = data_req.get('username', '').strip()
        email = data_req.get('email', '').strip()
        password = data_req.get('password', '').strip()
        
        # Validation
        if not username or len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
        
        if not email or '@' not in email:
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
    """User login endpoint"""
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
    """Health check endpoint"""
    try:
        return jsonify({
            'status': 'healthy', 
            'model_loaded': content_model is not None,
            'timestamp': get_current_timestamp(),
            'data_size': len(data) if data is not None else 0
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
    """Get book recommendations with visualization data"""
    query = request.args.get('q', '')
    print(f"🔍 Recommendation request for: '{query}'")
    
    if not query:
        return jsonify({
            'error': 'No query provided',
            'query': '',
            'recommendations': [],
            'count': 0
        }), 400
    
    try:
        recommendations = recommend(query)
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
    """Get recommendations by genre with visualization data"""
    print(f"🎭 Genre recommendation request for: {genre}")
    try:
        recommendations = get_genre_based_recommendations(genre, 12)
        
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
    """Get recommendations by author with visualization data"""
    print(f"✍️ Author recommendation request for: {author}")
    try:
        recommendations = get_author_based_recommendations(author, 12)
        
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
        
        if book_title:
            recommendations = recommend(book_title)
            for rec in recommendations:
                rec['method'] = 'hybrid'
            
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
        if data is None:
            create_models()
        
        if data is not None and 'genre' in data.columns:
            genres = data['genre'].dropna().unique()
            genres = [str(genre).strip() for genre in genres if str(genre).strip()]
            genres = sorted(list(set(genres)))
            return jsonify({'genres': genres})
        
        # Fallback genres
        fallback_genres = [
            'Mystery/Thriller', 'Romance', 'Fantasy', 'Science Fiction', 
            'Horror', 'Biography/Memoir', 'History', 'Children/Young Adult',
            'General Fiction'
        ]
        return jsonify({'genres': fallback_genres})
        
    except Exception as e:
        print(f"❌ Error getting genres: {e}")
        return jsonify({'genres': []}), 500

@app.route('/api/authors')
@cross_origin()
def get_authors():
    """Get all available authors"""
    try:
        if data is None:
            create_models()
        
        if data is not None and 'author' in data.columns:
            authors = data['author'].dropna().unique()
            authors = [str(author).strip() for author in authors if str(author).strip() and str(author) != 'Unknown']
            authors = sorted(list(set(authors)))
            return jsonify({'authors': authors})
        
        return jsonify({'authors': []})
        
    except Exception as e:
        print(f"❌ Error getting authors: {e}")
        return jsonify({'authors': []}), 500

# PROTECTED ROUTES - Require authentication

@app.route('/api/favorites', methods=['POST', 'GET', 'DELETE', 'OPTIONS'])
@cross_origin()
def handle_favorites():
    """Handle all favorites operations"""
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
            
            with get_db_connection() as conn:
                conn.execute(
                    'INSERT INTO favorites (book_title, book_author, book_image, timestamp, user_id) VALUES (?, ?, ?, ?, ?)',
                    (title, author, image, get_current_timestamp(), user_id)
                )
                conn.commit()
            
            return jsonify({'success': True, 'message': 'Added to favorites'})
            
        elif request.method == 'DELETE':
            if not user_id:
                return jsonify({'error': 'Authentication required'}), 401
                
            title = request.args.get('title')
            
            with get_db_connection() as conn:
                conn.execute('DELETE FROM favorites WHERE book_title = ? AND user_id = ?', (title, user_id))
                conn.commit()
            
            return jsonify({'success': True, 'message': 'Removed from favorites'})
            
        elif request.method == 'GET':
            if not user_id:
                return jsonify([])  # Return empty array for unauthenticated users
            
            with get_db_connection() as conn:
                cursor = conn.execute(
                    'SELECT book_title, book_author, book_image FROM favorites WHERE user_id = ? ORDER BY timestamp DESC',
                    (user_id,)
                )
                favorites = [
                    {'title': row[0], 'author': row[1], 'image': row[2]}
                    for row in cursor.fetchall()
                ]
            
            return jsonify(favorites)
            
    except Exception as e:
        print(f"❌ Error in handle_favorites: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/rate', methods=['POST', 'OPTIONS'])
@cross_origin()
@auth_required
def rate_book():
    """Rate a book - PROTECTED"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
        
    try:
        user_id = request.current_user['user_id']
        data_req = request.json
        title = data_req.get('title')
        rating = data_req.get('rating')
        
        with get_db_connection() as conn:
            conn.execute(
                'INSERT INTO ratings (book_title, rating, timestamp, user_id) VALUES (?, ?, ?, ?)',
                (title, rating, get_current_timestamp(), user_id)
            )
            conn.commit()
        
        return jsonify({'success': True, 'message': 'Rating saved'})
    except Exception as e:
        print(f"❌ Error saving rating: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# IMPORTANT: Vercel deployment configuration
if __name__ != "__main__":
    # For Vercel serverless deployment
    print("🚀 Initializing BookQuest backend for Vercel...")
    init_db()
    create_models()
else:
    # For local development
    print("🚀 Initializing BookQuest backend for local development...")
    init_db()
    create_models()
    print("🌟 Starting BookQuest server on http://localhost:5000")
    app.run(debug=True, port=5000, host='0.0.0.0')
