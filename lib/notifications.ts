// lib/notifications.ts
// Rappels de révision. Android : tâche en arrière-plan qui vérifie s'il y a vraiment des
// cartes dues avant de notifier. iOS restreint trop l'exécution en fond pour ça de façon
// fiable, donc on y programme un simple rappel quotidien à heure fixe.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { isDue } from '../utils/fsrs';

export const NOTIFICATIONS_ENABLED_KEY = 'reviewRemindersEnabled';
const BACKGROUND_TASK_NAME = 'synapse-due-cards-check';
const IOS_REMINDER_HOUR = 19;
const IOS_REMINDER_MINUTE = 0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getDueCardsCount(): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return 0;

  const { data: cards, error } = await supabase
    .from('cards')
    .select('next_review, decks!inner(user_id)')
    .eq('decks.user_id', session.user.id);

  if (error || !cards) return 0;

  return cards.filter(card => isDue(card.next_review)).length;
}

// Doit être défini au niveau module (pas dans un composant) pour que l'OS puisse
// le retrouver quand il réveille l'app en arrière-plan.
TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    const dueCount = await getDueCardsCount();
    if (dueCount > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Synapse',
          body: `${dueCount} carte${dueCount > 1 ? 's' : ''} à réviser aujourd'hui !`,
        },
        trigger: null,
      });
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('review-reminders', {
    name: 'Rappels de révision',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function requestPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function enableReviewReminders(): Promise<boolean> {
  const granted = await requestPermission();
  if (!granted) return false;

  await configureAndroidChannel();

  // scheduleNotificationAsync/registerTaskAsync n'écrasent pas un appel précédent :
  // sans ce nettoyage, activer le rappel plusieurs fois (toggle, rechargement en dev...)
  // empile des rappels quotidiens identiques qui se déclenchent tous en même temps.
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (Platform.OS === 'android') {
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: 6 * 60, // minutes ; l'OS espace généralement bien au-delà
    });
  } else if (Platform.OS === 'ios') {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Synapse',
        body: "C'est l'heure de réviser vos cartes !",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: IOS_REMINDER_HOUR,
        minute: IOS_REMINDER_MINUTE,
      },
    });
  }

  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
  return true;
}

export async function disableReviewReminders(): Promise<void> {
  if (Platform.OS === 'android') {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (registered) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK_NAME);
    }
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
}

export async function areReviewRemindersEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
  return value === 'true';
}
