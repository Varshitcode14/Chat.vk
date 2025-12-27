from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Chat, Message, User
import os
import requests

chat_bp = Blueprint('chat', __name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

@chat_bp.route('', methods=['GET'])
@jwt_required()
def get_chats():
    try:
        user_id = int(get_jwt_identity())
        chats = Chat.query.filter_by(user_id=user_id).order_by(Chat.created_at.desc()).all()
        return jsonify([chat.to_dict() for chat in chats]), 200
    except Exception as e:
        print(f"[Backend] Error in get_chats: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": str(e)}), 500

@chat_bp.route('', methods=['POST'])
@jwt_required()
def create_chat():
    try:
        user_id = int(get_jwt_identity())
        
        # Verify user exists
        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404
            
        chat = Chat(user_id=user_id, title="New Chat")
        db.session.add(chat)
        db.session.commit()
        return jsonify(chat.to_dict()), 201
    except Exception as e:
        print(f"[Backend] Error in create_chat: {str(e)}")
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"message": str(e)}), 500

@chat_bp.route('/<int:chat_id>/messages', methods=['GET'])
@jwt_required()
def get_messages(chat_id):
    user_id = int(get_jwt_identity())
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != user_id:
        return jsonify({"message": "Unauthorized"}), 403
    return jsonify([msg.to_dict() for msg in chat.messages]), 200

@chat_bp.route('/<int:chat_id>/messages', methods=['POST'])
@jwt_required()
def send_message(chat_id):
    user_id = int(get_jwt_identity())
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != user_id:
        return jsonify({"message": "Unauthorized"}), 403
    
    data = request.get_json()
    user_msg = Message(chat_id=chat_id, role='user', content=data['content'])
    db.session.add(user_msg)
    db.session.commit()
    
    history = [{"role": m.role, "content": m.content} for m in chat.messages]
    
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        return jsonify({"message": "GROQ_API_KEY not configured"}), 500
        
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": history
    }
    
    try:
        response = requests.post(GROQ_API_URL, json=payload, headers=headers)
        response_data = response.json()
        
        if response.status_code != 200:
            error_msg = response_data.get('error', {}).get('message', 'Unknown error')
            return jsonify({"message": f"Groq API error: {error_msg}"}), 500
            
        ai_content = response_data['choices'][0]['message']['content']
        ai_msg = Message(chat_id=chat_id, role='assistant', content=ai_content)
        db.session.add(ai_msg)
        db.session.commit()
        return jsonify(ai_msg.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error: {str(e)}"}), 500

@chat_bp.route('/<int:chat_id>', methods=['DELETE'])
@jwt_required()
def delete_chat(chat_id):
    user_id = int(get_jwt_identity())
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != user_id:
        return jsonify({"message": "Unauthorized"}), 403
    db.session.delete(chat)
    db.session.commit()
    return jsonify({"message": "Chat deleted"}), 200
