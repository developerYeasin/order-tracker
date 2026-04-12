from flask import Flask, send_from_directory
import os
from dotenv import load_dotenv
from extensions import db
from cache import Cache

load_dotenv()

def create_app():
    app = Flask(__name__)

    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'order-tracker-secret-change-in-production')
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER', 'order_user')}:{os.getenv('DB_PASSWORD', 'order_pass')}@{os.getenv('DB_HOST', 'localhost')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME', 'order_tracker')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

    # Cache configuration
    app.config['CACHE_ENABLED'] = os.getenv('CACHE_ENABLED', 'true').lower() == 'true'
    app.config['CACHE_TYPE'] = os.getenv('CACHE_TYPE', 'database')
    app.config['CACHE_TTL_FILE'] = int(os.getenv('CACHE_TTL_FILE', 300))

    db.init_app(app)

    # Initialize cache after database
    cache = Cache(app)
    app.cache = cache  # Make available via current_app.cache

    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Register blueprints
    from routes.auth import auth_bp
    from routes.orders import orders_bp
    from routes.media import media_bp
    from routes.analytics import analytics_bp
    from routes.activity import activity_bp
    from routes.settings import settings_bp
    from routes.webhooks import webhooks_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(orders_bp, url_prefix='/api')
    app.register_blueprint(media_bp, url_prefix='/api')
    app.register_blueprint(analytics_bp, url_prefix='/api')
    app.register_blueprint(activity_bp, url_prefix='/api')
    app.register_blueprint(settings_bp, url_prefix='/api')
    app.register_blueprint(webhooks_bp, url_prefix='/api')

    # Serve uploaded files statically
    @app.route('/uploads/<path:filepath>')
    def serve_upload(filepath):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filepath)

    # Serve frontend static files (SPA)
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        # If it's an API route, let it be handled by blueprints (return None to continue searching)
        if path.startswith('api/'):
            return None
        # Serve frontend index.html for SPA routing
        frontend_path = os.path.join(os.path.dirname(__file__), '..', 'dist')
        if path and os.path.exists(os.path.join(frontend_path, path)):
            return send_from_directory(frontend_path, path)
        return send_from_directory(frontend_path, 'index.html')

    # Health check
    @app.route('/health', methods=['GET'])
    def health_check():
        return {'status': 'healthy'}, 200

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 8090)), debug=os.getenv('DEBUG', 'False').lower() == 'true')
