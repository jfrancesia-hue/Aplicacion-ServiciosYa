import type React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Platform, // Import Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SheetContainer from './sheet/SheetContainer';
import type { Achievement as BaseAchievement, UserAchievement } from '../lib/constants/achievements';


interface AchievementsBottomSheetProps<TAchievements extends readonly BaseAchievement[]> {
  achievements: TAchievements;
  completedKeys: ReadonlyArray<TAchievements[number]['key']>;
}

// Update the component signature to ensure proper type inference
function AchievementsBottomSheet<const TAchievements extends readonly BaseAchievement[]>({
  completedKeys,
  achievements,
}: AchievementsBottomSheetProps<TAchievements>) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const completionPercentage = Math.round(
    (completedKeys.length / achievements.length) * 100,
  );

  const colors = {
    primary: '#00A79D',
    accentOrange: '#F9A825',
    backgroundLight: '#F7FAFC',
    backgroundDark: '#1A202C',
    black: '#000000',
    white: '#FFFFFF',
  };

  const userAchievements: UserAchievement[] = achievements.map(
    (achievement, index) => {
      const isCompleted = completedKeys.includes(achievement.key);
      const isNext =
        !isCompleted &&
        (index === 0 || completedKeys.includes(achievements[index - 1].key));

      return { ...achievement, completed: isCompleted, isNext };
    },
  );

  const renderAchievement = (achievement: UserAchievement, index: number) => {
    const isLast = index === achievements.length - 1;
    const isLocked = !achievement.completed && !achievement.isNext;

    // Define the background color for the icon circle based on the state.
    const getIconCircleBackgroundColor = () => {
      if (achievement.completed) {
        return colors.primary;
      }
      if (achievement.isNext) {
        return colors.accentOrange;
      }
      if (isLocked) {
        return isDark ? '#4B5563' : '#D1D5DB';
      }
      // Default background color if none of the conditions are met
      return isDark ? '#4B5563' : '#D1D5DB';
    };

    return (
      <View key={achievement.key} style={styles.achievementRow}>
        {/* Icon Column */}
        <View style={styles.iconColumn}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: getIconCircleBackgroundColor() }, // Apply background color here
              achievement.isNext && styles.nextIconRing,
            ]}
          >
            <MaterialIcons
              name={isLocked ? 'lock' : achievement.icon}
              size={24}
              color={colors.white}
              style={isLocked && { color: isDark ? '#9CA3AF' : '#6B7280' }}
            />
          </View>
          {!isLast && (
            <View
              style={[
                styles.connector,
                {
                  backgroundColor:
                    achievement.completed || achievement.isNext
                      ? `${colors.primary}4D`
                      : isDark
                        ? '#374151'
                        : '#E5E7EB',
                },
              ]}
            />
          )}
        </View>

        {/* Content Column */}
        <View style={[styles.contentColumn, isLast && { paddingBottom: 0 }]}>
          <Text
            style={[
              styles.achievementTitle,
              { color: isDark ? colors.white : '#1F2937' },
              achievement.isNext && {
                color: isDark ? '#FB923C' : colors.accentOrange,
              },
              isLocked && {
                color: isDark ? '#6B7280' : '#9CA3AF',
              },
            ]}
          >
            {achievement.title}
          </Text>
          <Text
            style={[
              styles.achievementDescription,
              { color: isDark ? '#9CA3AF' : '#6B7280' },
              isLocked && {
                color: isDark ? '#4B5563' : '#9CA3AF',
              },
            ]}
          >
            {achievement.description}
          </Text>
          {achievement.isNext && (
            <Text
              style={[
                styles.nextText,
                { color: isDark ? '#FB923C' : colors.accentOrange },
              ]}
            >
              ¡Siguiente!
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SheetContainer
      style={{
        ...styles.container,
        backgroundColor: isDark ? colors.backgroundDark : colors.backgroundLight,
      }}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: isDark ? '#374151' : '#E5E7EB' },
        ]}
      >
        <Text
          style={[
            styles.headerTitle,
            { color: isDark ? colors.white : '#1F2937' },
          ]}
        >
          Logros
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            { color: isDark ? '#9CA3AF' : '#6B7280' },
          ]}
        >
          Completá hitos para desbloquear más.
        </Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text
              style={[
                styles.progressLabel,
                { color: isDark ? '#D1D5DB' : '#374151' },
              ]}
            >
              Progreso General
            </Text>
            <Text
              style={[
                styles.progressPercentage,
                { color: isDark ? '#5EEAD4' : colors.primary },
              ]}
            >
              {completionPercentage}%
            </Text>
          </View>
          <View
            style={[
              styles.progressBarBackground,
              { backgroundColor: isDark ? '#374151' : '#E5E7EB' },
            ]}
          >
            <LinearGradient
              colors={[colors.primary, colors.accentOrange]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressBarFill,
                { width: `${completionPercentage}%` },
              ]}
            />
          </View>
        </View>

        {/* Achievements List */}
        <View style={styles.achievementsList}>
          {userAchievements.map(renderAchievement)}
        </View>
      </ScrollView>
    </SheetContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 6,
  },
  handleContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 6,
    borderRadius: 3,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBarBackground: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  achievementsList: {
    gap: 0,
  },
  achievementRow: {
    flexDirection: 'row',
    opacity: 1,
  },
  iconColumn: {
    alignItems: 'center',
    marginRight: 16,
    width: 48,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    // Apply platform-specific shadow styles
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  nextIconRing: {
    borderWidth: 4,
    borderColor: 'rgba(249, 168, 37, 0.3)',
  },
  connector: {
    width: 1,
    flex: 1,
  },
  contentColumn: {
    flex: 1,
    paddingBottom: 32,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  nextText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});

export default AchievementsBottomSheet;
