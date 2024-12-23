import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, Image, FlatList, StyleSheet, TouchableOpacity,
    SafeAreaView, TextInput, KeyboardAvoidingView, Platform,
    ActivityIndicator, AppState
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSocket } from '../../context/SocketContext';
import axios from 'axios';
import { API_ENDPOINTS } from '../../apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ChatScreen = ({ route, navigation }) => {
    const { socket, userId } = useSocket();
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const { userId: chatPartnerId, userName, userAvatar } = route.params;
    const [partnerOnline, setPartnerOnline] = useState(false);
    const [partnerTyping, setPartnerTyping] = useState(false);
    const typingTimeoutRef = useRef(null);
    const flatListRef = useRef(null);

    // Thêm hàm markMessagesAsRead
    const markMessagesAsRead = useCallback(() => {
        if (!socket || !chatPartnerId) return;
        
        socket.emit('mark_messages_read', {
            userId,
            fromUserId: chatPartnerId
        });
    }, [socket, chatPartnerId, userId]);

    // Sử dụng markMessagesAsRead trong useEffect
    useEffect(() => {
        if (!socket || !chatPartnerId) return;

        markMessagesAsRead();
        
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                markMessagesAsRead();
            }
        });

        return () => subscription.remove();
    }, [socket, chatPartnerId, markMessagesAsRead]);

    // Tối ưu fetch messages
    useEffect(() => {
        if (!socket) return;
        let isSubscribed = true;

        const fetchMessages = async (pageNum = 1) => {
            try {
                if (pageNum === 1) setLoading(true);
                const token = await AsyncStorage.getItem('userToken');
                
                const [messagesRes, userRes] = await Promise.all([
                    axios.get(
                        `${API_ENDPOINTS.socketURL}/api/chat/messages/${chatPartnerId}`,
                        {
                            params: { page: pageNum, limit: 30 },
                            headers: { 'Authorization': `Bearer ${token}` }
                        }
                    ),
                    axios.get(`${API_ENDPOINTS.socketURL}/api/chat/online-users`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                if (!isSubscribed) return;

                const { messages: newMessages, hasMore: moreMessages } = messagesRes.data;
                
                setMessages(prev => {
                    const messageMap = new Map(prev.map(msg => [msg._id, msg]));
                    newMessages.forEach(msg => messageMap.set(msg._id, msg));
                    return Array.from(messageMap.values())
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                });
                
                setHasMore(moreMessages);
                setPartnerOnline(userRes.data.some(user => user._id === chatPartnerId));
            } catch (error) {
                console.error('Error fetching messages:', error);
            } finally {
                if (isSubscribed) {
                    setLoading(false);
                    setLoadingMore(false);
                }
            }
        };

        fetchMessages();

        // Cập nhật socket handlers để sử dụng markMessagesAsRead
        const socketHandlers = {
            receive_message: (newMessage) => {
                if (newMessage.sender._id === chatPartnerId) {
                    setMessages(prev => {
                        if (prev.some(msg => msg._id === newMessage._id)) return prev;
                        markMessagesAsRead();
                        return [newMessage, ...prev];
                    });
                }
            },
            
            messages_marked_read: ({ fromUserId }) => {
                if (fromUserId === chatPartnerId) {
                    setMessages(prev => 
                        prev.map(msg => 
                            msg.sender._id === userId ? { ...msg, read: true } : msg
                        )
                    );
                }
            },

            user_status_changed: ({ userId: changedUserId, isOnline }) => {
                if (changedUserId === chatPartnerId) {
                    setPartnerOnline(isOnline);
                }
            },

            typing_status: ({ userId: typingUserId, isTyping }) => {
                if (typingUserId === chatPartnerId) {
                    setPartnerTyping(isTyping);
                }
            }
        };

        // Register socket handlers
        Object.entries(socketHandlers).forEach(([event, handler]) => {
            socket.on(event, handler);
        });

        return () => {
            isSubscribed = false;
            Object.keys(socketHandlers).forEach(event => {
                socket.off(event);
            });
        };
    }, [socket, chatPartnerId, userId, markMessagesAsRead]);

    // Tối ưu hóa việc gửi tin nhắn
    const sendMessage = useCallback(() => {
        if (!socket || !inputMessage.trim()) return;

        const messageData = {
            _id: Date.now().toString(),
            content: inputMessage.trim(),
            type: 'text',
            sender: { _id: userId },
            createdAt: new Date().toISOString(),
            pending: true
        };

        setMessages(prev => [messageData, ...prev]);
        setInputMessage('');

        socket.emit('send_message', {
            senderId: userId,
            receiverId: chatPartnerId,
            content: messageData.content,
            type: 'text',
            tempId: messageData._id
        }, (error) => {
            if (error) {
                setMessages(prev => 
                    prev.map(msg => 
                        msg._id === messageData._id 
                            ? { ...msg, error: true, pending: false }
                            : msg
                    )
                );
            }
        });
    }, [inputMessage, chatPartnerId, userId, socket]);

    // Xử lý typing status
    const handleTyping = useCallback((text) => {
        setInputMessage(text);
        
        if (socket) {
            socket.emit('typing', {
                userId,
                receiverId: chatPartnerId,
                isTyping: text.length > 0
            });

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('typing', {
                    userId,
                    receiverId: chatPartnerId,
                    isTyping: false
                });
            }, 1000);
        }
    }, [socket, userId, chatPartnerId]);

    // Load more messages
    const loadMoreMessages = useCallback(() => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        setPage(prev => prev + 1);
    }, [hasMore, loadingMore]);

    // Components
    const ChatHeader = useCallback(() => (
        <View style={styles.headerContainer}>
            <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            
            <View style={styles.userInfo}>
                <Image 
                    source={{ uri: userAvatar || 'https://via.placeholder.com/40' }} 
                    style={styles.avatar} 
                />
                <View style={styles.userStatus}>
                    <Text style={styles.userName}>{userName}</Text>
                    <View style={styles.onlineStatusContainer}>
                        <View style={[
                            styles.onlineDot,
                            !partnerOnline && styles.offlineDot
                        ]} />
                        <Text style={[
                            styles.activeStatus,
                            !partnerOnline && styles.offlineStatus
                        ]}>
                            {partnerTyping 
                                ? 'Đang nhập...' 
                                : partnerOnline 
                                    ? 'Đang hoạt động' 
                                    : 'Không hoạt động'
                            }
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    ), [partnerOnline, partnerTyping, userName, userAvatar]);

    const renderMessage = useCallback(({ item }) => {
        const isUserMessage = item.sender._id === userId;
        const messageTime = new Date(item.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        return (
            <View style={[
                styles.messageContainer,
                isUserMessage ? styles.userMessage : styles.otherMessage
            ]}>
                {!isUserMessage && (
                    <Image 
                        source={{ uri: userAvatar || 'https://via.placeholder.com/30' }} 
                        style={styles.messageAvatar} 
                    />
                )}
                <View style={[
                    styles.messageBubble,
                    isUserMessage ? styles.userBubble : styles.otherBubble,
                    item.pending && styles.pendingMessage,
                    item.error && styles.errorMessage
                ]}>
                    <Text style={[
                        styles.messageText,
                        isUserMessage ? styles.userMessageText : styles.otherMessageText
                    ]}>
                        {item.content}
                    </Text>
                    <View style={styles.messageFooter}>
                        <Text style={styles.timestamp}>{messageTime}</Text>
                        {isUserMessage && (
                            item.pending ? (
                                <Ionicons name="time-outline" size={12} color="#999" />
                            ) : item.error ? (
                                <Ionicons name="alert-circle" size={12} color="#ff4444" />
                            ) : item.read ? (
                                <Text style={styles.readStatus}>Đã xem</Text>
                            ) : (
                                <Text style={styles.readStatus}>Đã gửi</Text>
                            )
                        )}
                    </View>
                </View>
            </View>
        );
    }, [userId, userAvatar]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0084ff" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ChatHeader />
            <KeyboardAvoidingView 
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : null}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item._id}
                    renderItem={renderMessage}
                    inverted
                    onEndReached={loadMoreMessages}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore ? (
                        <ActivityIndicator size="small" color="#0084ff" />
                    ) : null}
                    contentContainerStyle={styles.messagesList}
                />
                
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputMessage}
                        onChangeText={handleTyping}
                        placeholder="Nhập tin nhắn..."
                        multiline
                    />
                    <TouchableOpacity 
                        style={[
                            styles.sendButton,
                            !inputMessage.trim() && styles.sendButtonDisabled
                        ]}
                        onPress={sendMessage}
                        disabled={!inputMessage.trim()}
                    >
                        <Ionicons 
                            name="send" 
                            size={24} 
                            color={inputMessage.trim() ? "#0084ff" : "#999"} 
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesList: {
    paddingHorizontal: 10,
  },
  messageContainer: {
    marginVertical: 5,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  userMessage: {
    justifyContent: 'flex-end',
    marginLeft: 50,
  },
  otherMessage: {
    justifyContent: 'flex-start',
    marginRight: 50,
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#0084ff',
    borderBottomRightRadius: 5,
  },
  otherBubble: {
    backgroundColor: '#e4e6eb',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
  },
  userMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e4e6eb',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0084ff',
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e6eb',
    height: 60,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e4e6eb',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 5,
  },
  userStatus: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  onlineStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  offlineDot: {
    backgroundColor: '#999',
  },
  activeStatus: {
    fontSize: 12,
    color: '#4CAF50',
  },
  offlineStatus: {
    color: '#999',
  },
  backButton: {
    padding: 8,
    marginRight: 10,
    borderRadius: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  readStatus: {
    fontSize: 11,
    color: '#999',
    marginLeft: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorMessage: {
    backgroundColor: '#ffebee',
  },
  pendingStatus: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  errorStatus: {
    fontSize: 11,
    color: '#f44336',
  },
  sentStatus: {
    fontSize: 11,
    color: '#999',
  },
  pendingMessage: {
    opacity: 0.7
},
errorMessage: {
    backgroundColor: '#ffebee'
},
sendButtonDisabled: {
    opacity: 0.5
}
});

export default ChatScreen;