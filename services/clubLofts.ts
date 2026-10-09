import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getClubDistances } from './storage';
import { DEFAULT_LOFTS, loftsFrom, type Lofts } from '../data/clubs';

/**
 * Club lofts for labels ("SW 56°"), refreshed whenever the screen gains focus so
 * an edit on the Clubs tab shows up straight away. Starts from the defaults, so
 * labels are right even before (or without) the network read.
 */
export function useClubLofts(): Lofts {
  const [lofts, setLofts] = useState<Lofts>(DEFAULT_LOFTS);
  useFocusEffect(useCallback(() => {
    let alive = true;
    getClubDistances().then(cd => { if (alive) setLofts(loftsFrom(cd)); }).catch(() => {});
    return () => { alive = false; };
  }, []));
  return lofts;
}
