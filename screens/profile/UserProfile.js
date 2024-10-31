import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dimensions, View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getUserProfileById, getUserPostsWithID, followUser, unfollowUser, getUserTravelPosts } from '../../apiConfig';

const windowWidth = Dimensions.get('window').width;
const imageSize = (windowWidth - 45) / 2;

const PersonalInfo = ({ userProfile }) => {
  const [expanded, setExpanded] = useState(false);

  const infoItems = [
    { 
      icon: 'mail-outline', 
      label: 'Email', 
      value: userProfile?.email,
      priority: 1
    },
    { 
      icon: 'call-outline', 
      label: 'Số điện thoại', 
      value: userProfile?.sdt,
      priority: 2
    },
    { 
      icon: 'person-outline', 
      label: 'Giới tính', 
      value: userProfile?.sex,
      priority: 3
    },
    { 
      icon: 'heart-outline', 
      label: 'Tình trạng hôn nhân', 
      value: userProfile?.tinhtranghonnhan,
      priority: 4
    },
    { 
      icon: 'calendar-outline', 
      label: 'Ngày sinh', 
      value: userProfile?.ngaysinh,
      priority: 5
    },
    { 
      icon: 'location-outline', 
      label: 'Địa chỉ', 
      value: userProfile?.diachi,
      priority: 6
    },
  ]
  .filter(item => item.value)
  .sort((a, b) => a.priority - b.priority);

  const displayedItems = expanded ? infoItems : infoItems.slice(0, 3);
  const hasMoreItems = infoItems.length > 3;

  return (
    <View style={styles.personalInfoContainer}>
      <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
      <View style={styles.infoContent}>
        {displayedItems.map((item, index) => (
          <View 
            key={index} 
            style={[
              styles.infoItem,
              index === displayedItems.length - 1 && styles.lastItem
            ]}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={item.icon} size={20} color="#666" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      {hasMoreItems && (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.expandButtonText}>
            {expanded ? 'Thu gọn' : `Xem thêm (${infoItems.length - 3})`}
          </Text>
          <Ionicons 
            name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} 
            size={20} 
            color="#0095f6"
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const UserProfile = ({ route }) => {
  const { userId } = route.params;
  const [userProfile, setUserProfile] = useState(null);
  const [normalPosts, setNormalPosts] = useState([]);
  const [travelPosts, setTravelPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowingMe, setIsFollowingMe] = useState(false);
  const [isFriend, setIsFriend] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [profileData, postsData, travelPostsData] = await Promise.all([
          getUserProfileById(userId),
          getUserPostsWithID(userId),
          getUserTravelPosts(userId)
        ]);
        
        setUserProfile(profileData);
        setNormalPosts(postsData);
        setTravelPosts(travelPostsData);
        setIsFollowing(profileData.isFollowing || false);
        setIsFollowingMe(profileData.isFollowingMe || false);
        setIsFriend(profileData.isFollowing && profileData.isFollowingMe);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load profile');
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  const handleFollowToggle = async () => {
    if (isFollowing) {
      Alert.alert(
        "Xác nhận hủy theo dõi",
        isFriend ? 
          "Bạn có chắc chắn muốn hủy kết bạn với người dùng này?" :
          "Bạn có chắc chắn muốn hủy theo dõi người dùng này?",
        [
          {
            text: "Hủy",
            style: "cancel"
          },
          {
            text: "Đồng ý",
            onPress: async () => {
              try {
                const result = await unfollowUser(userId);
                setIsFollowing(false);
                setIsFriend(false);
                setUserProfile(prevProfile => ({
                  ...prevProfile,
                  thong_ke: {
                    ...prevProfile.thong_ke,
                    nguoi_theo_doi: prevProfile.thong_ke.nguoi_theo_doi - 1
                  }
                }));
                Alert.alert('Thành công', result.message);
              } catch (error) {
                console.error('Error unfollowing user:', error);
                Alert.alert('Lỗi', 'Không thể hủy theo dõi người dùng này');
              }
            }
          }
        ]
      );
    } else {
      try {
        const result = await followUser(userId);
        setIsFollowing(true);
        const newIsFriend = isFollowingMe;
        setIsFriend(newIsFriend);
        setUserProfile(prevProfile => ({
          ...prevProfile,
          thong_ke: {
            ...prevProfile.thong_ke,
            nguoi_theo_doi: prevProfile.thong_ke.nguoi_theo_doi + 1
          }
        }));
        Alert.alert('Thành công', 
          newIsFriend ? 'Các bạn đã trở thành bạn bè!' : 'Đã theo dõi thành công!'
        );
      } catch (error) {
        console.error('Error following user:', error);
        Alert.alert('Lỗi', 'Không thể theo dõi người dùng này');
      }
    }
  };

  const avatarUri = useMemo(() => userProfile?.anh_dai_dien || null, [userProfile?.anh_dai_dien]);

  const handlePostPress = useCallback((post) => {
    if (!post?._id) {
      Alert.alert('Lỗi', 'Không thể mở bài viết này');
      return;
    }

    if (activeTab === 'travel') {
      navigation.navigate('TravelPostDetail', { 
        postId: post._id,
        title: post.title || 'Chi tiết bài viết du lịch'
      });
    } else {
      navigation.navigate('PostDetailScreen', { 
        postId: post._id,
        title: post.title || 'Chi tiết bài viết'
      });
    }
  }, [navigation, activeTab]);

  const renderFollowButton = useCallback(() => {
    if (isFriend) {
      return (
        <TouchableOpacity
          style={[styles.followButton, styles.friendButton]}
          onPress={handleFollowToggle}
        >
          <Text style={styles.followButtonText}>Bạn bè</Text>
        </TouchableOpacity>
      );
    }

    if (isFollowingMe && !isFollowing) {
      return (
        <TouchableOpacity
          style={[styles.followButton, styles.followBackButton]}
          onPress={handleFollowToggle}
        >
          <Text style={styles.followButtonText}>Theo dõi lại</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.followButton, isFollowing && styles.followingButton]}
        onPress={handleFollowToggle}
      >
        <Text style={styles.followButtonText}>
          {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
        </Text>
      </TouchableOpacity>
    );
  }, [isFriend, isFollowingMe, isFollowing, handleFollowToggle]);

  const renderPostItem = useCallback((post) => {
    return (
      <TouchableOpacity 
        key={post._id} 
        style={styles.postItem}
        onPress={() => handlePostPress(post)}
      >
        <View style={styles.postImageContainer}>
          {post.images && post.images.length > 0 ? (
            <Image
              source={{ uri: post.images[0] }}
              style={styles.postImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.postImage, styles.noImageContainer]}>
              <Ionicons name="image-outline" size={24} color="#666" />
            </View>
          )}
          {post.images && post.images.length > 1 && (
            <View style={styles.multipleImagesIndicator}>
              <Ionicons name="copy-outline" size={16} color="#fff" />
            </View>
          )}
        </View>
        
        <View style={styles.postInfo}>
          <Text style={styles.postTitle} numberOfLines={1}>
            {post.title || 'Untitled'}
          </Text>
          
          {activeTab === 'travel' && (
            <>
              <Text style={styles.postLocation} numberOfLines={1}>
                <Ionicons name="location-outline" size={12} color="#666" />
                {post.destinationName || 'No location'}
              </Text>
              {post.startDate && (
                <Text style={styles.travelDate}>
                  <Ionicons name="calendar-outline" size={12} color="#666" />
                  {new Date(post.startDate).toLocaleDateString()}
                </Text>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [activeTab, handlePostPress]);

  const handleMessagePress = useCallback(() => {
    if (!userId) {
      Alert.alert('Lỗi', 'Không thể tạo cuộc trò chuyện vào lúc này');
      return;
    }

    console.log('Receiver Info:', {
      receiverId: userId,
      receiverName: userProfile?.username,
      receiverAvatar: userProfile?.anh_dai_dien
    });

    navigation.navigate('ChatScreen', {
      receiverId: userId,
      receiverName: userProfile?.username || 'Người dùng',
      receiverAvatar: userProfile?.anh_dai_dien || null
    });
  }, [navigation, userId, userProfile]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  if (!userProfile) {
    return <Text style={styles.errorText}>No profile data available</Text>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <View style={styles.usernameContainer}>
            <Text style={styles.username}>{userProfile.username}</Text>
            {userProfile.xacMinhDanhTinh && (
              <Ionicons name="checkmark-circle" size={20} color="#1DA1F2" style={styles.verifiedIcon} />
            )}
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="ellipsis-vertical" size={24} color="black" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileContainer}>
          <View style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.placeholderImage]}>
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
            )}
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{normalPosts.length + travelPosts.length}</Text>
              <Text style={styles.statLabel}>bài viết</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userProfile.thong_ke.nguoi_theo_doi}</Text>
              <Text style={styles.statLabel}>người theo dõi</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userProfile.thong_ke.dang_theo_doi}</Text>
              <Text style={styles.statLabel}>đang theo dõi</Text>
            </View>
          </View>
        </View>

        <Text style={styles.bioText}>{userProfile.bio || 'No bio available'}</Text>

        {/* Follow/Message Buttons */}
        <View style={styles.buttonContainer}>
          {renderFollowButton()}
          <TouchableOpacity 
            style={styles.messageButton}
            onPress={handleMessagePress}
          >
            <Text style={styles.messageButtonText}>Nhắn tin</Text>
          </TouchableOpacity>
        </View>

        {/* Personal Information */}
        <PersonalInfo userProfile={userProfile} />

        {/* Posts Section with Tabs */}
        <View style={styles.postsContainer}>
          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
              onPress={() => setActiveTab('posts')}
            >
              <Ionicons 
                name="grid-outline" 
                size={24} 
                color={activeTab === 'posts' ? '#0095F6' : '#262626'} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === 'posts' && styles.activeTabText
              ]}>
                Bài viết
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tab, activeTab === 'travel' && styles.activeTab]}
              onPress={() => setActiveTab('travel')}
            >
              <Ionicons 
                name="airplane-outline" 
                size={24} 
                color={activeTab === 'travel' ? '#0095F6' : '#262626'} 
              />
              <Text style={[
                styles.tabText, 
                activeTab === 'travel' && styles.activeTabText
              ]}>
                Du lịch
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.postGrid}>
            {activeTab === 'posts' ? (
              normalPosts.length > 0 ? (
                normalPosts.map(post => renderPostItem(post))
              ) : (
                <Text style={styles.emptyText}>Chưa có bài viết nào</Text>
              )
            ) : (
              travelPosts.length > 0 ? (
                travelPosts.map(post => renderPostItem(post))
              ) : (
                <Text style={styles.emptyText}>Chưa có bài viết du lịch nào</Text>
              )
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    marginTop:"5%"
  },
  username: {
    color: 'black',
    fontSize: 23,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  followingButton: {
    backgroundColor: '#E0E0E0',
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 15,
  },
  profileContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 10,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  placeholderImage: {
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flex: 1,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: 'black',
    fontSize: 14,
  },
  bioText: {
    color: 'black',
    fontSize: 15,
    marginTop: 5,
    marginLeft: 10,
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 15,
  },
  followButton: {
    flex: 1,
    backgroundColor: '#0095F6',
    paddingVertical: 8,
    borderRadius: 5,
    marginRight: 5,
  },
  followingButton: {
    backgroundColor: '#E0E0E0',
  },
  followButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  messageButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    borderRadius: 5,
    marginLeft: 5,
  },
  messageButtonText: {
    color: 'black',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  postsContainer: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  postGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  postItem: {
    width: (windowWidth - 45) / 2,
    marginBottom: 15,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: imageSize,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  postInfo: {
    padding: 10,
  },
  postTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  noPostsText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#888',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  personalInfoContainer: {
    marginTop: 20,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 16,
    flex: 1,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },

  expandButtonText: {
    color: '#0095f6',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  friendButton: {
    backgroundColor: '#34B7F1',
  },
  followBackButton: {
    backgroundColor: '#FF6B6B',
  },
  defaultButton: {
    backgroundColor: '#0095f6',
  },
  followingButton: {
    backgroundColor: '#ddd',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#DBDBDB',
    marginBottom: 15,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0095F6',
  },
  tabText: {
    fontSize: 14,
    color: '#262626',
  },
  activeTabText: {
    color: '#0095F6',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 20,
  },
  postImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  multipleImagesIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  postLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  travelDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  noImageContainer: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    overflow: 'hidden',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#262626',
    fontWeight: '500',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
});

export default React.memo(UserProfile);
