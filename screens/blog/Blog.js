import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, TextInput, Alert, RefreshControl } from 'react-native';
import { toggleLikePost, addComment, getComments, getToken, getFeedPosts } from '../../apiConfig';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
const LIKE_COLOR = '#FF6B6B';
const UNLIKE_COLOR = '#757575';

const BlogPage = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likeStates, setLikeStates] = useState({});
  const [userToken, setUserToken] = useState(null);
  const navigation = useNavigation();
  const [commentText, setCommentText] = useState('');
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [error, setError] = useState(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const feedPosts = await getFeedPosts();
      setPosts(feedPosts);

      const initialLikeStates = {};
      feedPosts.forEach(post => {
        initialLikeStates[post._id] = {
          isLiked: post.likes.includes(currentUserId),
          likesCount: post.likesCount
        };
      });
      setLikeStates(initialLikeStates);
    } catch (error) {
      console.error('Lỗi khi lấy bài viết từ feed:', error);
      setError('Không thể lấy bài viết từ feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);
  useEffect(() => {
   
  }, [posts]);


  useEffect(() => {
    const fetchUserToken = async () => {
      const token = await getToken();
      setUserToken(token);
    };
    fetchUserToken();
  }, []);

  useEffect(() => {
    getCurrentUserId();
    fetchPosts();
  }, [userToken, fetchPosts]);

  const getCurrentUserId = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const { id } = JSON.parse(userData);
        setCurrentUserId(id);
      }
    } catch (error) {
      console.error('Error fetching current user ID:', error);
    }
  };

  const handleUserPress = useCallback((userId) => {
    if (userId === currentUserId) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('UserProfile', { userId });
    }
  }, [navigation, currentUserId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, [fetchPosts]);

  const handlePostPress = useCallback((post) => {
    navigation.navigate('PostDetailScreen', { postId: post._id });
  }, [navigation]);

  const handleLikePress = useCallback(async (postId) => {
    setLikeStates(prevStates => {
      const currentState = prevStates[postId];
      return {
        ...prevStates,
        [postId]: {
          isLiked: !currentState.isLiked,
          likesCount: currentState.isLiked ? currentState.likesCount - 1 : currentState.likesCount + 1
        }
      };
    });

    try {
      const result = await toggleLikePost(postId);
      setLikeStates(prevStates => ({
        ...prevStates,
        [postId]: {
          isLiked: result.likes.includes(currentUserId),
          likesCount: result.likesCount
        }
      }));
    } catch (error) {
      console.error('Lỗi khi thay đổi trạng thái like:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật trạng thái like');
      setLikeStates(prevStates => {
        const currentState = prevStates[postId];
        return {
          ...prevStates,
          [postId]: {
            isLiked: !currentState.isLiked,
            likesCount: currentState.isLiked ? currentState.likesCount + 1 : currentState.likesCount - 1
          }
        };
      });
    }
  }, [currentUserId]);

  const handleCommentPress = useCallback((postId) => {
    setSelectedPostId(prevId => prevId === postId ? null : postId);
    if (selectedPostId !== postId) {
      getComments(postId).then(data => {
        setPosts(prevPosts => prevPosts.map(post =>
          post._id === postId ? { ...post, comments: data.comments } : post
        ));
      }).catch(error => {
        console.error('Error fetching comments:', error);
        Alert.alert('Error', 'Failed to fetch comments');
      });
    }
  }, [selectedPostId]);

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim() || !selectedPostId) return;

    try {
      const result = await addComment(selectedPostId, commentText);
      setPosts(prevPosts => prevPosts.map(post =>
        post._id === selectedPostId
          ? {
            ...post,
            comments: [result.comment, ...(post.comments || [])],
            commentsCount: (post.commentsCount || 0) + 1
          }
          : post
      ));
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  }, [selectedPostId, commentText]);

  const renderPost = useCallback(({ item: post }) => (
    <View key={post._id} style={styles.postCard}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => handleUserPress(post.user._id)}
        
      >
        {post.user && post.user.avatar ? (
          <Image
            source={{ uri: post.user.avatar }}
            style={styles.avatar}
            onError={(e) => console.log('Avatar load error:', e.nativeEvent.error)}
          />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Ionicons name="person-outline" size={20} color="#fff" />
          </View>
        )}
        <View>
          <Text style={styles.username}>{post.user ? post.user.username : 'Unknown User'}</Text>
          <Text style={styles.postDate}>{new Date(post.createdAt).toLocaleDateString()}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => handlePostPress(post)}>
      <Text style={styles.postContent}>{post.title}</Text>

      {post.images && post.images.length > 0 && (
        <Image
          source={{ uri: post.images[0] }}
          style={styles.postImage}
          onError={(e) => console.log('Post image load error:', e.nativeEvent.error)}
        />
      )}
    </TouchableOpacity>
      <View style={styles.interactionInfo}>
        <TouchableOpacity
          style={styles.interactionItem}
          onPress={() => handleLikePress(post._id)}
        >
          <Ionicons
            name={likeStates[post._id]?.isLiked ? "heart" : "heart-outline"}
            size={24}
            color={likeStates[post._id]?.isLiked ? LIKE_COLOR : UNLIKE_COLOR}
          />
          <Text style={styles.interactionText}>
            {likeStates[post._id]?.likesCount || 0} Likes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.interactionItem}
          onPress={() => handleCommentPress(post._id)}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#555" />
          <Text style={styles.interactionText}>{post.commentsCount || 0} Comments</Text>
        </TouchableOpacity>
      </View>

      {selectedPostId === post._id && (
        <View style={styles.commentSection}>
          <TextInput
            style={styles.commentInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment..."
          />
          <TouchableOpacity style={styles.addCommentButton} onPress={handleAddComment}>
            <Text style={styles.addCommentButtonText}>Add Comment</Text>
          </TouchableOpacity>
          <FlatList
            data={post.comments}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentUserInfo}>
                    {item.userAvatar ? (
                      <Image
                        source={{ uri: item.userAvatar }}
                        style={styles.commentAvatar}
                        onError={(e) => console.log('Comment avatar load error:', e.nativeEvent.error)}
                      />
                    ) : (
                      <View style={[styles.commentAvatar, styles.placeholderAvatar]}>
                        <Ionicons name="person-outline" size={16} color="#fff" />
                      </View>
                    )}
                    <Text style={styles.commentUser}>
                      {item.username || item.user?.username || 'Unknown User'}
                    </Text>
                  </View>
                  <Text style={styles.commentDate}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.commentContent}>{item.content}</Text>
              </View>
            )}
          />
        </View>
      )}
    </View>
  ), [handleUserPress, handleLikePress, handleCommentPress, likeStates, selectedPostId, commentText, handleAddComment]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerText}>Social Feed</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EDEDED',
  },
  headerText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  postCard: {
    backgroundColor: '#fff',
    marginBottom: 10,
    padding: 15,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  placeholderAvatar: {
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  postDate: {
    fontSize: 14,
    color: '#888',
  },
  postContent: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
    lineHeight: 24,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  interactionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  interactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  interactionText: {
    marginLeft: 5,
    color: '#555',
  },
  commentSection: {
    marginTop: 10,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  addCommentButton: {
    backgroundColor: '#0066cc',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  addCommentButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  commentItem: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  commentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  commentUser: {
    fontWeight: 'bold',
  },
  commentDate: {
    fontSize: 12,
    color: '#888',
  },
  commentContent: {
    fontSize: 14,
  },
});

export default React.memo(BlogPage);