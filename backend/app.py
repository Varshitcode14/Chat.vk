from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
try:
    from .config import Config
    from .models import db
    from .routes.auth import auth_bp
    from .routes.chat import chat_bp
except (ImportError, ValueError):
    from config import Config
    from models import db
    from routes.auth import auth_bp
    from routes.chat import chat_bp

app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions
CORS(app, resources={r"/*": {"origins": "*"}})
db.init_app(app)
jwt = JWTManager(app)

app.url_map.strict_slashes = False

@jwt.invalid_token_loader
def invalid_token_callback(error_string):
    print(f"[Backend] Invalid JWT token: {error_string}")
    return jsonify({"message": "Invalid token", "error": error_string}), 401

@jwt.unauthorized_loader
def unauthorized_callback(error_string):
    print(f"[Backend] Unauthorized - missing JWT: {error_string}")
    return jsonify({"message": "Missing authorization token", "error": error_string}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    print(f"[Backend] Expired JWT token")
    return jsonify({"message": "Token has expired"}), 401

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(chat_bp, url_prefix='/chat')

# Create tables
with app.app_context():
    db.create_all()
    print("[Backend] Database tables created successfully")

@app.route('/health')
def health():
    return {'status': 'ok'}, 200

@app.errorhandler(Exception)
def handle_exception(e):
    print(f"[Backend] Unhandled exception: {str(e)}")
    import traceback
    traceback.print_exc()
    return jsonify({"message": "Internal server error", "error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
