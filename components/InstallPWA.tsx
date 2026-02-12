import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import { getHasAddedToHomeScreen } from '../services/StorageService';

export default function InstallPWA() {
  const [showInstall, setShowInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Only on web
    if (Platform.OS !== 'web') return;

    const checkInstallStatus = async () => {
      // Check if already installed (standalone mode)
      const isInstalled = await getHasAddedToHomeScreen();

      if (!isInstalled) {
        // Simple delay to not annoy immediately
        setTimeout(() => {
          setShowInstall(true);
        }, 2000);
      }
    };

    checkInstallStatus();

    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);
  }, []);

  if (!showInstall) return null;

  return (
    <Modal animationType="slide" transparent={true} visible={showInstall}>
      <View className="flex-1 justify-end">
        <View className="bg-white m-4 p-6 rounded-3xl shadow-xl border border-gray-100 pb-10">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-[#2C3E50]">Install Clarity</Text>
            <TouchableOpacity onPress={() => setShowInstall(false)}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          <Text className="text-gray-600 mb-6 text-base">
            For the best experience, add Clarity to your home screen. It will work offline and send notifications!
          </Text>

          {isIOS ? (
            <View className="bg-[#F7F7F7] p-4 rounded-xl">
              <View className="flex-row items-center mb-3">
                <Ionicons name="share-outline" size={24} color="#FF9F87" />
                <Text className="ml-3 text-[#2C3E50] font-medium">1. Tap the Share button</Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="add-circle-outline" size={24} color="#FF9F87" />
                <Text className="ml-3 text-[#2C3E50] font-medium">2. Select "Add to Home Screen"</Text>
              </View>
            </View>
          ) : (
            <Text className="text-gray-500 italic text-center">
              Tap the menu icon and select "Install App" or "Add to Home Screen".
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
