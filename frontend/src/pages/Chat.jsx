"use client"

import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import "../styles/chat.css"

// Configure axios base URL for backend API
axios.defaults.baseURL = "http://localhost:5000"

function Chat() {
  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    }
    loadChats()
  }, [])

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat)
    }
  }, [activeChat])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")
    return {
      Authorization: `Bearer ${token}`,
    }
  }

  const loadChats = async () => {
    try {
      const response = await axios.get("/chat", {
        headers: getAuthHeaders(),
      })
      setChats(response.data)
    } catch (error) {
      console.error("Failed to load chats:", error)
      if (error.response?.status === 401) {
        navigate("/login")
      }
    }
  }

  const loadMessages = async (chatId) => {
    try {
      const response = await axios.get(`/chat/${chatId}/messages`, {
        headers: getAuthHeaders(),
      })
      setMessages(response.data)
    } catch (error) {
      console.error("Failed to load messages:", error)
    }
  }

  const handleNewChat = async () => {
    try {
      const response = await axios.post(
        "/chat",
        {},
        {
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
        },
      )
      const newChat = response.data
      setChats([newChat, ...chats])
      setActiveChat(newChat.id)
      setMessages([])
    } catch (error) {
      console.error("Failed to create chat:", error)
      console.error("Error response:", error.response?.data)
    }
  }

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation()
    try {
      await axios.delete(`/chat/${chatId}`, {
        headers: getAuthHeaders(),
      })
      setChats(chats.filter((chat) => chat.id !== chatId))
      if (activeChat === chatId) {
        setActiveChat(null)
        setMessages([])
      }
    } catch (error) {
      console.error("Failed to delete chat:", error)
    }
  }

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault()

    if (!input.trim() || loading) {
      return
    }

    let chatId = activeChat

    if (!chatId) {
      try {
        const response = await axios.post(
          "/chat",
          {},
          {
            headers: {
              ...getAuthHeaders(),
              "Content-Type": "application/json",
            },
          },
        )
        const newChat = response.data
        setChats((prev) => [newChat, ...prev])
        setActiveChat(newChat.id)
        chatId = newChat.id
      } catch (error) {
        console.error("Failed to auto-create chat:", error)
        return
      }
    }

    const currentInput = input.trim()
    const userMessage = {
      role: "user",
      content: currentInput,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const response = await axios.post(
        `/chat/${chatId}/messages`,
        { content: currentInput },
        {
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
        },
      )

      await loadMessages(chatId)
      await loadChats()
    } catch (error) {
      console.error("Failed to send message:", error)
      setMessages((prev) => prev.slice(0, -1))
      alert(error.response?.data?.message || "Failed to send message")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <button className="new-chat-button" onClick={handleNewChat}>
            <span>+</span> New Chat
          </button>
        </div>

        <div className="chat-list">
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`chat-item ${activeChat === chat.id ? "active" : ""}`}
              onClick={() => setActiveChat(chat.id)}
            >
              <span className="chat-item-text">{chat.title}</span>
              <button className="delete-chat-button" onClick={(e) => handleDeleteChat(chat.id, e)}>
                ×
              </button>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <span>{user?.username || "User"}</span>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <h2>{activeChat ? chats.find((c) => c.id === activeChat)?.title || "Chat" : "New Chat"}</h2>
        </div>

        <div className="chat-messages">
          {!activeChat || messages.length === 0 ? (
            <div className="empty-state">
              <h3>{activeChat ? "Start a conversation" : "Welcome to Chat.VK"}</h3>
              <p>{activeChat ? "Type a message below to begin" : "Type a message to start a new chat"}</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-avatar">{message.role === "user" ? "U" : "AI"}</div>
                <div className="message-content">{message.content}</div>
              </div>
            ))
          )}
          {loading && (
            <div className="message assistant">
              <div className="message-avatar">AI</div>
              <div className="loading-message">
                <span>Thinking</span>
                <div className="loading-dots">
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          <form className="chat-input-wrapper" onSubmit={handleSendMessage}>
            <textarea
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(e)
                }
              }}
              placeholder="Send a message..."
              rows="1"
              disabled={loading}
            />
            <button className="send-button" type="submit" disabled={!input.trim() || loading}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M1 8L15 1L8 15L6 9L1 8Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Chat
