import { useState } from 'react';
import { Alert } from 'react-native';
import { unregister } from '../services/siteService';
import { formatDay } from '../types';

type Target = { id: string; sport: string; description: string; date: string; siteDate: string };

/** Asks for confirmation, then unregisters on the site. `busyId` is the target being cancelled. */
export function useUnregister(onDone: () => void) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const ask = (t: Target) => {
    if (busyId) return;
    Alert.alert(
      'Se désinscrire ?',
      `${t.sport}\n${formatDay(t.date)} — ${t.description}`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Se désinscrire',
          style: 'destructive',
          onPress: async () => {
            setBusyId(t.id);
            try {
              const message = await unregister(t);
              Alert.alert('Désinscription effectuée', message);
            } catch (e) {
              Alert.alert(
                'Désinscription impossible',
                `${e instanceof Error ? e.message : String(e)}\n\nVérifiez dans « Mes inscriptions ».`
              );
            } finally {
              setBusyId(null);
              onDone();
            }
          },
        },
      ]
    );
  };

  return { busyId, ask };
}
