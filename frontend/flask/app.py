import numpy as np
import pandas as pd
from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_cors import CORS, cross_origin
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
from scipy.sparse import csr_matrix
import os
import requests
import sqlite3
from contextlib import contextmanager
from datetime import datetime

app = Flask(__name__)

CORS(app, 
     origins=["http://localhost:3000"],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
    """Initialize SQLite database for analytics and user data"""
    conn = sqlite3.connect(DB_PATH)
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
            timestamp TEXT
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY,
            book_title TEXT,
            book_author TEXT,
            book_image TEXT,
            timestamp TEXT
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

def create_models():
    """Create both content-based and collaborative filtering models"""
    global content_model, collaborative_model, data, user_item_matrix, book_features
    
    # Load data with proper column mapping for your dataset
    data = pd.read_csv(CSV_PATH)
    print(f"📊 Loaded {len(data)} books")
    print(f"📊 Dataset columns: {list(data.columns)}")
    
    # Map your column names to standard names
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
    
    # Create collaborative filtering
    create_collaborative_model()
    
    print("✅ Enhanced ML models created successfully!")
    return data, content_model, collaborative_model

def create_collaborative_model():
    """Create collaborative filtering model with synthetic user data"""
    global collaborative_model, user_item_matrix
    
    num_users = 1000
    num_books = len(data)
    
    np.random.seed(42)
    ratings = []
    
    for user_id in range(num_users):
        num_ratings = np.random.randint(10, 51)
        book_indices = np.random.choice(num_books, num_ratings, replace=False)
        
        for book_idx in book_indices:
            base_rating = data.iloc[book_idx]['rating']
            rating = max(1, min(5, base_rating + np.random.normal(0, 0.5)))
            ratings.append([user_id, book_idx, rating])
    
    ratings_df = pd.DataFrame(ratings, columns=['user_id', 'book_id', 'rating'])
    
    user_item_matrix = ratings_df.pivot(
        index='user_id', 
        columns='book_id', 
        values='rating'
    ).fillna(0)
    
    user_item_sparse = csr_matrix(user_item_matrix.values)
    
    svd = TruncatedSVD(n_components=50, random_state=42)
    user_features = svd.fit_transform(user_item_sparse)
    
    collaborative_model = NearestNeighbors(
        metric='cosine',
        algorithm='brute',
        n_neighbors=20
    )
    collaborative_model.fit(user_features)
    
    print("🤝 Collaborative filtering model created")

def fetch_book_details_from_google(book_title):
    """
    Fetch detailed book information from Google Books API
    """
    try:
        print(f"📖 Fetching details for: {book_title}")
        
        # Clean the book title for better search results
        clean_title = book_title.replace(' (', '').replace(')', '').strip()
        
        # Google Books API endpoint
        api_url = "https://www.googleapis.com/books/v1/volumes"
        params = {
            'q': f'intitle:"{clean_title}"',
            'maxResults': 5,
            'printType': 'books'
        }
        
        response = requests.get(api_url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'items' in data and len(data['items']) > 0:
                # Find the best match
                best_match = None
                best_score = 0
                
                for item in data['items']:
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
                    best_match = data['items'].get('volumeInfo', {})
                
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
                
                print(f"✅ Found book details for: {book_details['title']}")
                return book_details
            else:
                print(f"❌ No books found for: {book_title}")
                return {'error': f'No books found for "{book_title}" in Google Books database'}
        else:
            print(f"❌ API request failed with status: {response.status_code}")
            return {'error': f'API request failed with status {response.status_code}'}
            
    except requests.exceptions.Timeout:
        print(f"⏰ Request timeout for: {book_title}")
        return {'error': 'Request timeout. Please try again later.'}
    except requests.exceptions.RequestException as e:
        print(f"🌐 Network error for {book_title}: {e}")
        return {'error': f'Network error: {str(e)}'}
    except Exception as e:
        print(f"❌ Unexpected error for {book_title}: {e}")
        return {'error': f'Unexpected error: {str(e)}'}

def recommend(choice):
    """Enhanced recommendation algorithm"""
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
            choice_index = exact_match.index
            print(f"✅ Found exact match: {exact_match.iloc['title']}")
        else:
            # Try partial match
            partial_matches = data[data['title'].str.contains(choice, case=False, na=False)]
            if not partial_matches.empty:
                best_match = partial_matches.iloc
                choice_index = best_match.name
                print(f"✅ Found partial match: {best_match['title']}")
            else:
                # Try author search
                author_matches = data[data['author'].str.contains(choice, case=False, na=False)]
                if not author_matches.empty:
                    choice_index = author_matches.index
                    print(f"✅ Found author match: {author_matches.iloc['title']}")
        
        # Fallback to popular books
        if choice_index is None:
            print(f"❌ No matches found for: '{choice}', returning popular books")
            popular = data.nlargest(8, 'rating')
            
            result = []
            for _, book in popular.iterrows():
                image_val = book.get('image', '')
                if pd.isna(image_val) or str(image_val).lower() in ['nan', '', 'null']:
                    image_val = f"https://via.placeholder.com/200x300/4a5568/ffffff?text={book['title'][:20].replace(' ', '+')}"
                
                book_dict = {
                    'title': str(book['title']),
                    'author': str(book.get('author', 'Unknown')),
                    'rating': float(book.get('rating', 0)),
                    'image': str(image_val),
                    'similarity': 0.7,
                    'genre': str(book.get('genre', 'General'))
                }
                result.append(book_dict)
            
            return result
        
        # Get similar books using ML model
        distances, indices = content_model.kneighbors(
            book_features[choice_index], 
            n_neighbors=min(12, len(data))
        )
        
        book_list = []
        for i in indices.flatten():
            if i != choice_index:
                book_data = data.iloc[i]
                
                image_val = book_data.get('image', '')
                if pd.isna(image_val) or str(image_val).lower() in ['nan', '', 'null']:
                    image_val = f"https://via.placeholder.com/200x300/4a5568/ffffff?text={book_data['title'][:20].replace(' ', '+')}"
                
                book_dict = {
                    'title': str(book_data['title']),
                    'author': str(book_data.get('author', 'Unknown')),
                    'rating': float(book_data.get('rating', 0)),
                    'image': str(image_val),
                    'similarity': float(1 - distances[list(indices.flatten()).index(i)]),
                    'genre': str(book_data.get('genre', 'General'))
                }
                book_list.append(book_dict)
        
        book_list.sort(key=lambda x: x['similarity'], reverse=True)
        return book_list[:8]
        
    except Exception as e:
        print(f"❌ Error in recommend: {e}")
        return []

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
    """Get book recommendations"""
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

# NEW: Book details endpoint using Google Books API
@app.route('/api/book/<path:book_title>')
@cross_origin()
def get_book_details(book_title):
    """Get detailed book information from Google Books API"""
    print(f"📖 Getting details for: {book_title}")
    
    try:
        book_details = fetch_book_details_from_google(book_title)
        return jsonify(book_details)
        
    except Exception as e:
        print(f"❌ Error getting book details: {e}")
        return jsonify({
            'error': f'Failed to fetch book details: {str(e)}',
            'title': book_title
        }), 500

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

# Favorites and ratings endpoints
@app.route('/api/favorites', methods=['POST', 'GET', 'DELETE', 'OPTIONS'])
@cross_origin()
def handle_favorites():
    """Handle all favorites operations"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
        
    try:
        if request.method == 'POST':
            data_req = request.json
            title = data_req.get('title')
            author = data_req.get('author', '')
            image = data_req.get('image', '')
            
            print(f"❤️ Adding to favorites: {title}")
            
            with get_db_connection() as conn:
                conn.execute(
                    'INSERT INTO favorites (book_title, book_author, book_image, timestamp) VALUES (?, ?, ?, ?)',
                    (title, author, image, get_current_timestamp())
                )
                conn.commit()
            
            return jsonify({'success': True, 'message': 'Added to favorites'})
            
        elif request.method == 'DELETE':
            title = request.args.get('title')
            print(f"💔 Removing from favorites: {title}")
            
            with get_db_connection() as conn:
                conn.execute('DELETE FROM favorites WHERE book_title = ?', (title,))
                conn.commit()
            
            return jsonify({'success': True, 'message': 'Removed from favorites'})
            
        elif request.method == 'GET':
            print("📋 Getting favorites")
            
            with get_db_connection() as conn:
                cursor = conn.execute('SELECT book_title, book_author, book_image FROM favorites ORDER BY timestamp DESC')
                favorites = [
                    {'title': row, 'author': row[1], 'image': row[11]}
                    for row in cursor.fetchall()
                ]
            
            print(f"✅ Found {len(favorites)} favorites")
            return jsonify(favorites)
            
    except Exception as e:
        print(f"❌ Error in handle_favorites: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/rate', methods=['POST', 'OPTIONS'])
@cross_origin()
def rate_book():
    """Rate a book"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
        
    try:
        data_req = request.json
        title = data_req.get('title')
        rating = data_req.get('rating')
        
        print(f"⭐ Rating book: {title} - {rating} stars")
        
        with get_db_connection() as conn:
            conn.execute(
                'INSERT INTO ratings (book_title, rating, timestamp) VALUES (?, ?, ?)',
                (title, rating, get_current_timestamp())
            )
            conn.commit()
        
        return jsonify({'success': True, 'message': 'Rating saved'})
    except Exception as e:
        print(f"❌ Error saving rating: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# Initialize database and model on startup
print("🚀 Initializing BookQuest backend...")
init_db()
create_models()

if __name__ == "__main__":
    print("🌟 Starting BookQuest server on http://localhost:5000")
    app.run(debug=True, port=5000, host='0.0.0.0')
