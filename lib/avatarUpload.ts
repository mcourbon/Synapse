// lib/avatarUpload.ts
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Import conditionnel de FileSystem (seulement pour mobile)
let FileSystem: any;
if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system');
}

export class AvatarUpload {
  /**
   * Demande la permission d'accès à la galerie
   */
  static async requestPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Ouvre le sélecteur d'image
   */
  static async pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
    const hasPermission = await this.requestPermission();
    
    if (!hasPermission) {
      throw new Error('Permission refusée pour accéder à la galerie');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0];
  }

  /**
   * Upload l'image dans Supabase Storage (VERSION WEB)
   */
  static async uploadAvatarWeb(
  userId: string,
  imageAsset: ImagePicker.ImagePickerAsset
): Promise<string> {

  try {
    // Sur web, l'URI est souvent un data URI
    let fileExt = 'jpg'; // Par défaut
    
    // Si c'est un data URI, extraire le type MIME
    if (imageAsset.uri.startsWith('data:')) {
      const mimeMatch = imageAsset.uri.match(/data:image\/(\w+);/);
      if (mimeMatch) {
        fileExt = mimeMatch[1].toLowerCase();
      }
    } else {
      // Sinon, extraire normalement
      fileExt = imageAsset.uri.split('.').pop()?.toLowerCase() || 'jpg';
    }

    // Nom de fichier COURT et simple
    const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;
    

    const response = await fetch(imageAsset.uri);
    const blob = await response.blob();
    

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, blob, {
        contentType: blob.type || `image/${fileExt}`,
        upsert: false,
      });

    if (error) {
      throw error;
    }


    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path);


    return urlData.publicUrl;
  } catch (error) {
    throw error;
  }
}

  /**
   * Upload l'image dans Supabase Storage (VERSION MOBILE)
   */
  static async uploadAvatarMobile(
    userId: string,
    imageAsset: ImagePicker.ImagePickerAsset
  ): Promise<string> {

    const { decode } = require('base64-arraybuffer');
    
    const fileExt = imageAsset.uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    

    try {
      // Lire le fichier avec FileSystem
      const base64 = await FileSystem.readAsStringAsync(imageAsset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      

      // Convertir en ArrayBuffer
      const arrayBuffer = decode(base64);
      

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (error) {
        throw error;
      }


      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);


      return urlData.publicUrl;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload l'image (détecte automatiquement la plateforme)
   */
  static async uploadAvatar(
    userId: string,
    imageAsset: ImagePicker.ImagePickerAsset
  ): Promise<string> {
    if (Platform.OS === 'web') {
      return this.uploadAvatarWeb(userId, imageAsset);
    } else {
      return this.uploadAvatarMobile(userId, imageAsset);
    }
  }

  /**
   * Supprime les anciens avatars de l'utilisateur, à l'exclusion du fichier qu'on
   * vient d'uploader (`keepFileName`) — appelée après un upload réussi, jamais avant.
   */
  static async deleteOldAvatar(userId: string, keepFileName?: string): Promise<void> {
    try {
      const { data: files, error: listError } = await supabase.storage
        .from('avatars')
        .list(userId);

      if (listError || !files || files.length === 0) {
        return;
      }

      const filePaths = files
        .filter(file => file.name !== keepFileName)
        .map(file => `${userId}/${file.name}`);

      if (filePaths.length === 0) {
        return;
      }

      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove(filePaths);

      if (deleteError) {
      } else {
      }
    } catch (error) {
    }
  }

  /**
   * Met à jour l'avatar de l'utilisateur.
   * Upload d'abord, nettoyage de l'ancien ensuite : si l'upload échoue (réseau,
   * permission storage...), l'utilisateur garde son ancien avatar au lieu de se
   * retrouver sans aucune photo.
   */
  static async updateUserAvatar(
    userId: string,
    imageAsset: ImagePicker.ImagePickerAsset
  ): Promise<string> {

    // 1. Upload le nouveau
    const avatarUrl = await this.uploadAvatar(userId, imageAsset);

    // 2. Mettre à jour la BDD
    const { error: updateError } = await supabase
      .from('user_stats')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    // 3. Nettoyer les anciens avatars maintenant que le nouveau est en place
    const newFileName = avatarUrl.split('/').pop()?.split('?')[0];
    await this.deleteOldAvatar(userId, newFileName);

    return avatarUrl;
  }
}