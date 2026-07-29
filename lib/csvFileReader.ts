// lib/csvFileReader.ts
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

export interface PickedCsvFile {
  fileName: string;
  content: string;
}

/** Ouvre le sélecteur de fichiers et retourne le contenu texte du CSV choisi (null si annulé). */
export async function pickAndReadCsvFile(): Promise<PickedCsvFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];

  if (Platform.OS === 'web') {
    const webFile = (asset as any).file as File | undefined;
    const content = webFile ? await webFile.text() : await (await fetch(asset.uri)).text();
    return { fileName: asset.name, content };
  }

  const FileSystem = require('expo-file-system');
  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return { fileName: asset.name, content };
}
