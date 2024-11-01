import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getUserProfile } from '../apiConfig'; // Đảm bảo import này chính xác
import AddOptionsModal from '../screens/modal/AddOptionsModal';
import TrangTimBanDuLich from './TrangChu/TrangTimBanDuLich';
import UserListScreen from '../screens/chat/UserListScreen';
import ThongBao from '../screens/ThongBao';
import MyProfile from '../screens/profile/MyProfile';

const Tab = createBottomTabNavigator();

// EmptyComponent for "Add" tab
const EmptyComponent = () => null;

const BottomTabs = () => {
  const [isModalVisible, setModalVisible] = useState(false);
  const [xacMinhDanhTinh, setXacMinhDanhTinh] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchUserProfile();
    }, [])
  );

  const fetchUserProfile = async () => {
    try {
      const profileData = await getUserProfile();
      setXacMinhDanhTinh(profileData.xacMinhDanhTinh);
      console.log('Trạng thái xác minh danh tính:', profileData.xacMinhDanhTinh);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin profile:', error);
    }
  };

  const toggleModal = () => {
    setModalVisible(!isModalVisible);
  };

  const handleTabPress = (event, route) => {
    if (!xacMinhDanhTinh && route.name !== 'Profile') {
      event.preventDefault();
      Alert.alert(
        "Xác minh danh tính",
        "Bạn cần xác minh danh tính để sử dụng chức năng này.",
        [
          {
            text: "Hủy",
            style: "cancel"
          },
          { 
            text: "Xác minh", 
            onPress: () => {
              navigation.navigate('IdentityVerification');
            }
          }
        ]
      );
    } else if (route.name === 'Add') {
      toggleModal();
    }
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ size }) => {
            let iconPath;
            switch (route.name) {
              case 'Home':
                iconPath = require('../assets/home.png');
                break;
              case 'Search':
                iconPath = require('../assets/search.png');
                break;
              case 'Notifications':
                iconPath = require('../assets/notifications.png');
                break;
              case 'Profile':
                iconPath = require('../assets/profile.png');
                break;
              default:
                iconPath = require('../assets/home.png');
            }
            return <Image source={iconPath} style={{ width: size, height: size }} />;
          },
          tabBarActiveTintColor: 'tomato',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={TrangTimBanDuLich} 
          options={{ headerShown: false }}
          listeners={{
            tabPress: (e) => handleTabPress(e, { name: 'Home' }),
          }}
        />
        <Tab.Screen 
          name="Search" 
          component={UserListScreen} 
          options={{ headerShown: false }}
          listeners={{
            tabPress: (e) => handleTabPress(e, { name: 'Search' }),
          }}
        />
        <Tab.Screen 
          name="Add" 
          component={EmptyComponent}
          options={{
            tabBarButton: (props) => (
              <TouchableOpacity
                {...props}
                onPress={(event) => handleTabPress(event, { name: 'Add' })}
              >
                <Image source={require('../assets/add.png')} style={{ width: 30, height: 30 }} />
              </TouchableOpacity>
            ),
          }}
        />
        <Tab.Screen 
          name="Notifications" 
          component={ThongBao} 
          options={{ headerShown: false }}
          listeners={{
            tabPress: (e) => handleTabPress(e, { name: 'Notifications' }),
          }}
        />
        <Tab.Screen 
          name="Profile" 
          component={MyProfile} 
          options={{ headerShown: false }}
        />
      </Tab.Navigator>
      <AddOptionsModal isVisible={isModalVisible} onClose={toggleModal} />
    </>
  );
};

export default BottomTabs;
