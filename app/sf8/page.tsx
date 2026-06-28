'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Printer, RefreshCw, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ─────────────────────────────────────────────────────────────────────────────
// DepEd / WHO BMI-FOR-AGE REFERENCE TABLE (5y0m – 19y0m, monthly granularity)
// Sourced directly from the official DepEd SF8 "Nutritional Status (Pre & Post)"
// reference worksheet. Each row: [ageInMonths,
//   boy_sw, boy_wFrom, boy_wTo, boy_nFrom, boy_nTo, boy_owFrom, boy_owTo,
//   girl_sw, girl_wFrom, girl_wTo, girl_nFrom, girl_nTo, girl_owFrom, girl_owTo ]
// Classification per column (BMI value "v" against a row's boy/girl values):
//   v <= sw              -> Severely Wasted
//   wFrom <= v <= wTo     -> Wasted
//   nFrom <= v <= nTo     -> Normal
//   owFrom <= v <= owTo   -> Overweight
//   v > owTo              -> Obese
// (Obese begins right after the Overweight "to" cutoff, per the DepEd table.)
// ─────────────────────────────────────────────────────────────────────────────

const BMI_FOR_AGE_TABLE: number[][] = [
  [60, 12.0,12.1,12.9,13.0,18.3,18.4,20.2, 11.7,11.8,12.6,12.7,18.9,19.0,21.2],
  [61, 12.0,12.1,12.9,13.0,18.3,18.4,20.2, 11.7,11.8,12.6,12.7,18.9,19.0,21.3],
  [62, 12.0,12.1,12.9,13.0,18.3,18.4,20.2, 11.7,11.8,12.6,12.7,18.9,19.0,21.4],
  [63, 12.0,12.1,12.9,13.0,18.3,18.4,20.2, 11.7,11.8,12.6,12.7,18.9,19.0,21.5],
  [64, 12.0,12.1,12.9,13.0,18.3,18.4,20.3, 11.7,11.8,12.6,12.7,18.9,19.0,21.5],
  [65, 12.0,12.1,12.9,13.0,18.3,18.4,20.3, 11.6,11.7,12.6,12.7,19.0,19.1,21.6],
  [66, 12.0,12.1,12.9,13.0,18.4,18.5,20.4, 11.6,11.7,12.6,12.7,19.0,19.1,21.7],
  [67, 12.0,12.1,12.9,13.0,18.4,18.5,20.4, 11.6,11.7,12.6,12.7,19.0,19.1,21.7],
  [68, 12.0,12.1,12.9,13.0,18.4,18.5,20.5, 11.6,11.7,12.6,12.7,19.1,19.2,21.8],
  [69, 12.0,12.1,12.9,13.0,18.4,18.5,20.5, 11.6,11.7,12.6,12.7,19.1,19.2,21.9],
  [70, 12.0,12.1,12.9,13.0,18.5,18.6,20.6, 11.6,11.7,12.6,12.7,19.1,19.2,22.0],
  [71, 12.0,12.1,12.9,13.0,18.5,18.6,20.6, 11.6,11.7,12.6,12.7,19.2,19.3,22.1],
  [72, 12.0,12.1,12.9,13.0,18.5,18.6,20.7, 11.6,11.7,12.6,12.7,19.2,19.3,22.1],
  [73, 12.0,12.1,12.9,13.0,18.6,18.7,20.8, 11.6,11.7,12.6,12.7,19.3,19.4,22.2],
  [74, 12.1,12.2,13.0,13.1,18.6,18.7,20.8, 11.6,11.7,12.6,12.7,19.3,19.4,22.3],
  [75, 12.1,12.2,13.0,13.1,18.6,18.7,20.9, 11.6,11.7,12.6,12.7,19.4,19.5,22.4],
  [76, 12.1,12.2,13.0,13.1,18.7,18.8,21.0, 11.6,11.7,12.6,12.7,19.4,19.5,22.5],
  [77, 12.1,12.2,13.0,13.1,18.7,18.8,21.0, 11.6,11.7,12.6,12.7,19.5,19.6,22.6],
  [78, 12.1,12.2,13.0,13.1,18.7,18.8,21.1, 11.6,11.7,12.6,12.7,19.5,19.6,22.7],
  [79, 12.1,12.2,13.0,13.1,18.8,18.9,21.2, 11.6,11.7,12.6,12.7,19.6,19.7,22.8],
  [80, 12.1,12.2,13.0,13.1,18.8,18.9,21.3, 11.6,11.7,12.6,12.7,19.6,19.7,22.9],
  [81, 12.1,12.2,13.0,13.1,18.9,19.0,21.3, 11.6,11.7,12.6,12.7,19.7,19.8,23.0],
  [82, 12.1,12.2,13.0,13.1,18.9,19.0,21.4, 11.6,11.7,12.6,12.7,19.7,19.8,23.1],
  [83, 12.1,12.2,13.0,13.1,19.0,19.1,21.5, 11.6,11.7,12.6,12.7,19.8,19.9,23.2],
  [84, 12.2,12.3,13.0,13.1,19.0,19.1,21.6, 11.7,11.8,12.6,12.7,19.8,19.9,23.3],
  [85, 12.2,12.3,13.1,13.2,19.1,19.2,21.7, 11.7,11.8,12.6,12.7,19.9,20.0,23.4],
  [86, 12.2,12.3,13.1,13.2,19.1,19.2,21.8, 11.7,11.8,12.7,12.8,20.0,20.1,23.5],
  [87, 12.2,12.3,13.1,13.2,19.2,19.3,21.9, 11.7,11.8,12.7,12.8,20.0,20.1,23.6],
  [88, 12.2,12.3,13.1,13.2,19.2,19.3,22.0, 11.7,11.8,12.7,12.8,20.1,20.2,23.7],
  [89, 12.2,12.3,13.1,13.2,19.3,19.4,22.0, 11.7,11.8,12.7,12.8,20.1,20.2,23.9],
  [90, 12.2,12.3,13.1,13.2,19.3,19.4,22.1, 11.7,11.8,12.7,12.8,20.2,20.3,24.0],
  [91, 12.2,12.3,13.1,13.2,19.4,19.5,22.2, 11.7,11.8,12.7,12.8,20.3,20.4,24.1],
  [92, 12.2,12.3,13.1,13.2,19.4,19.5,22.4, 11.7,11.8,12.7,12.8,20.3,20.4,24.2],
  [93, 12.3,12.4,13.2,13.3,19.5,19.6,22.5, 11.7,11.8,12.7,12.8,20.4,20.5,24.4],
  [94, 12.3,12.4,13.2,13.3,19.6,19.7,22.6, 11.8,11.9,12.8,12.9,20.5,20.6,24.5],
  [95, 12.3,12.4,13.2,13.3,19.6,19.7,22.7, 11.8,11.9,12.8,12.9,20.6,20.7,24.6],
  [96, 12.3,12.4,13.2,13.3,19.7,19.8,22.8, 11.8,11.9,12.8,12.9,20.6,20.7,24.8],
  [97, 12.3,12.4,13.2,13.3,19.7,19.8,22.9, 11.8,11.9,12.8,12.9,20.7,20.8,24.9],
  [98, 12.3,12.4,13.2,13.3,19.8,19.9,23.0, 11.8,11.9,12.8,12.9,20.8,20.9,25.1],
  [99, 12.3,12.4,13.2,13.3,19.9,20.0,23.1, 11.8,11.9,12.8,12.9,20.9,21.0,25.2],
  [100, 12.3,12.4,13.3,13.4,19.9,20.0,23.3, 11.8,11.9,12.9,13.0,20.9,21.0,25.3],
  [101, 12.4,12.5,13.3,13.4,20.0,20.1,23.4, 11.8,11.9,12.9,13.0,21.0,21.1,25.5],
  [102, 12.4,12.5,13.3,13.4,20.1,20.2,23.5, 11.9,12.0,12.9,13.0,21.1,21.2,25.6],
  [103, 12.4,12.5,13.3,13.4,20.1,20.2,23.6, 11.9,12.0,12.9,13.0,21.2,21.3,25.8],
  [104, 12.4,12.5,13.3,13.4,20.2,20.3,23.8, 11.9,12.0,12.9,13.0,21.3,21.4,25.9],
  [105, 12.4,12.5,13.3,13.4,20.3,20.4,23.9, 11.9,12.0,13.0,13.1,21.3,21.4,26.1],
  [106, 12.4,12.5,13.4,13.5,20.3,20.4,24.0, 12.0,12.1,13.0,13.1,21.4,21.5,26.2],
  [107, 12.4,12.5,13.4,13.5,20.4,20.5,24.2, 12.0,12.1,13.0,13.1,21.5,21.6,26.4],
  [108, 12.5,12.6,13.4,13.5,20.5,20.6,24.3, 12.0,12.1,13.0,13.1,21.6,21.7,26.5],
  [109, 12.5,12.6,13.4,13.5,20.5,20.6,24.4, 12.0,12.1,13.1,13.2,21.7,21.8,26.7],
  [110, 12.5,12.6,13.4,13.5,20.6,20.7,24.6, 12.0,12.1,13.1,13.2,21.8,21.9,26.8],
  [111, 12.5,12.6,13.4,13.5,20.7,20.8,24.7, 12.1,12.2,13.1,13.2,21.9,22.0,27.0],
  [112, 12.5,12.6,13.5,13.6,20.8,20.9,24.9, 12.1,12.2,13.1,13.2,21.9,22.0,27.2],
  [113, 12.5,12.6,13.5,13.6,20.8,20.9,25.0, 12.1,12.2,13.2,13.3,22.0,22.1,27.3],
  [114, 12.6,12.7,13.5,13.6,20.9,21.0,25.1, 12.1,12.2,13.2,13.3,22.1,22.2,27.5],
  [115, 12.6,12.7,13.5,13.6,21.0,21.1,25.3, 12.2,12.3,13.2,13.3,22.2,22.3,27.6],
  [116, 12.6,12.7,13.5,13.6,21.1,21.2,25.5, 12.2,12.3,13.3,13.4,22.3,22.4,27.8],
  [117, 12.6,12.7,13.6,13.7,21.2,21.3,25.6, 12.2,12.3,13.3,13.4,22.4,22.5,27.9],
  [118, 12.6,12.7,13.6,13.7,21.2,21.3,25.8, 12.2,12.3,13.3,13.4,22.5,22.6,28.1],
  [119, 12.7,12.8,13.6,13.7,21.3,21.4,25.9, 12.3,12.4,13.3,13.4,22.6,22.7,28.2],
  [120, 12.7,12.8,13.6,13.7,21.4,21.5,26.1, 12.3,12.4,13.4,13.5,22.7,22.8,28.4],
  [121, 12.7,12.8,13.7,13.8,21.5,21.6,26.2, 12.3,12.4,13.4,13.5,22.8,22.9,28.5],
  [122, 12.7,12.8,13.7,13.8,21.6,21.7,26.4, 12.3,12.4,13.4,13.5,22.9,23.0,28.7],
  [123, 12.7,12.8,13.7,13.8,21.7,21.8,26.6, 12.4,12.5,13.5,13.6,22.9,23.0,28.8],
  [124, 12.8,12.9,13.7,13.8,21.7,21.8,26.7, 12.4,12.5,13.5,13.6,23.0,23.1,29.0],
  [125, 12.8,12.9,13.8,13.9,21.8,21.9,26.9, 12.4,12.5,13.5,13.6,23.1,23.2,29.1],
  [126, 12.8,12.9,13.8,13.9,21.9,22.0,27.0, 12.4,12.5,13.6,13.7,23.2,23.3,29.3],
  [127, 12.8,12.9,13.8,13.9,22.0,22.1,27.2, 12.5,12.6,13.6,13.7,23.3,23.4,29.4],
  [128, 12.9,13.0,13.8,13.9,22.1,22.2,27.4, 12.5,12.6,13.6,13.7,23.4,23.5,29.6],
  [129, 12.9,13.0,13.9,14.0,22.2,22.3,27.5, 12.5,12.6,13.7,13.8,23.5,23.6,29.7],
  [130, 12.9,13.0,13.9,14.0,22.3,22.4,27.7, 12.6,12.7,13.7,13.8,23.6,23.7,29.9],
  [131, 12.9,13.0,13.9,14.0,22.4,22.5,27.9, 12.6,12.7,13.7,13.8,23.7,23.8,30.0],
  [132, 13.0,13.1,14.0,14.1,22.5,22.6,28.0, 12.6,12.7,13.8,13.9,23.8,23.9,30.2],
  [133, 13.0,13.1,14.0,14.1,22.5,22.6,28.2, 12.7,12.8,13.8,13.9,23.9,24.0,30.3],
  [134, 13.0,13.1,14.0,14.1,22.6,22.7,28.4, 12.7,12.8,13.9,14.0,24.0,24.1,30.5],
  [135, 13.0,13.1,14.0,14.1,22.7,22.8,28.5, 12.7,12.8,13.9,14.0,24.1,24.2,30.6],
  [136, 13.1,13.2,14.1,14.2,22.8,22.9,28.7, 12.8,12.9,13.9,14.0,24.2,24.3,30.8],
  [137, 13.1,13.2,14.1,14.2,22.9,23.0,28.8, 12.8,12.9,14.0,14.1,24.3,24.4,30.9],
  [138, 13.1,13.2,14.1,14.2,23.0,23.1,29.0, 12.8,12.9,14.0,14.1,24.4,24.5,31.1],
  [139, 13.1,13.2,14.2,14.3,23.1,23.2,29.2, 12.9,13.0,14.1,14.2,24.5,24.6,31.2],
  [140, 13.2,13.3,14.2,14.3,23.2,23.3,29.3, 12.9,13.0,14.1,14.2,24.6,24.7,31.4],
  [141, 13.2,13.3,14.2,14.3,23.3,23.4,29.5, 12.9,13.0,14.2,14.3,24.8,24.9,31.5],
  [142, 13.2,13.3,14.3,14.4,23.4,23.5,29.6, 13.0,13.1,14.2,14.3,24.9,25.0,31.6],
  [143, 13.3,13.4,14.3,14.4,23.5,23.6,29.8, 13.0,13.1,14.2,14.3,25.0,25.1,31.8],
  [144, 13.3,13.4,14.4,14.5,23.6,23.7,30.0, 13.1,13.2,14.3,14.4,25.1,25.2,31.9],
  [145, 13.3,13.4,14.4,14.5,23.7,23.8,30.1, 13.1,13.2,14.3,14.4,25.2,25.3,32.0],
  [146, 13.4,13.5,14.4,14.5,23.8,23.9,30.3, 13.1,13.2,14.4,14.5,25.3,25.4,32.2],
  [147, 13.4,13.5,14.5,14.6,23.9,24.0,30.4, 13.2,13.3,14.4,14.5,25.4,25.5,32.3],
  [148, 13.4,13.5,14.5,14.6,24.0,24.1,30.6, 13.2,13.3,14.5,14.6,25.5,25.6,32.4],
  [149, 13.5,13.6,14.5,14.6,24.1,24.2,30.7, 13.2,13.3,14.5,14.6,25.6,25.7,32.6],
  [150, 13.5,13.6,14.6,14.7,24.2,24.3,30.9, 13.3,13.4,14.6,14.7,25.7,25.8,32.7],
  [151, 13.5,13.6,14.6,14.7,24.3,24.4,31.0, 13.3,13.4,14.6,14.7,25.8,25.9,32.8],
  [152, 13.6,13.7,14.7,14.8,24.4,24.5,31.1, 13.4,13.5,14.7,14.8,25.9,26.0,33.0],
  [153, 13.6,13.7,14.7,14.8,24.5,24.6,31.3, 13.4,13.5,14.7,14.8,26.0,26.1,33.1],
  [154, 13.6,13.7,14.7,14.8,24.6,24.7,31.4, 13.4,13.5,14.7,14.8,26.1,26.2,33.2],
  [155, 13.7,13.8,14.8,14.9,24.7,24.8,31.6, 13.5,13.6,14.8,14.9,26.2,26.3,33.3],
  [156, 13.7,13.8,14.8,14.9,24.8,24.9,31.7, 13.5,13.6,14.8,14.9,26.3,26.4,33.4],
  [157, 13.7,13.8,14.9,15.0,24.9,25.0,31.8, 13.5,13.6,14.9,15.0,26.4,26.5,33.6],
  [158, 13.8,13.9,14.9,15.0,25.0,25.1,31.9, 13.6,13.7,14.9,15.0,26.5,26.6,33.7],
  [159, 13.8,13.9,15.0,15.1,25.1,25.2,32.1, 13.6,13.7,15.0,15.1,26.6,26.7,33.8],
  [160, 13.9,14.0,15.0,15.1,25.2,25.3,32.2, 13.7,13.8,15.0,15.1,26.7,26.8,33.9],
  [161, 13.9,14.0,15.1,15.2,25.2,25.3,32.3, 13.7,13.8,15.1,15.2,26.8,26.9,34.0],
  [162, 13.9,14.0,15.1,15.2,25.3,25.4,32.4, 13.7,13.8,15.1,15.2,26.9,27.0,34.1],
  [163, 14.0,14.1,15.1,15.2,25.4,25.5,32.6, 13.8,13.9,15.1,15.2,27.0,27.1,34.2],
  [164, 14.0,14.1,15.2,15.3,25.5,25.6,32.7, 13.8,13.9,15.2,15.3,27.1,27.2,34.3],
  [165, 14.0,14.1,15.2,15.3,25.6,25.7,32.8, 13.8,13.9,15.2,15.3,27.1,27.2,34.4],
  [166, 14.1,14.2,15.3,15.4,25.7,25.8,32.9, 13.9,14.0,15.3,15.4,27.2,27.3,34.5],
  [167, 14.1,14.2,15.3,15.4,25.8,25.9,33.0, 13.9,14.0,15.3,15.4,27.2,27.3,34.6],
  [168, 14.2,14.3,15.4,15.5,25.9,26.0,33.1, 13.9,14.0,15.3,15.4,27.3,27.4,34.7],
  [169, 14.2,14.3,15.4,15.5,26.0,26.1,33.2, 14.0,14.1,15.4,15.5,27.4,27.5,34.7],
  [170, 14.2,14.3,15.5,15.6,26.1,26.2,33.3, 14.0,14.1,15.4,15.5,27.5,27.6,34.8],
  [171, 14.3,14.4,15.5,15.6,26.2,26.3,33.4, 14.0,14.1,15.5,15.6,27.6,27.7,34.9],
  [172, 14.3,14.4,15.6,15.7,26.3,26.4,33.5, 14.0,14.1,15.5,15.6,27.7,27.8,35.0],
  [173, 14.4,14.5,15.6,15.7,26.4,26.5,33.5, 14.1,14.2,15.5,15.6,27.7,27.8,35.1],
  [174, 14.4,14.5,15.6,15.7,26.5,26.6,33.6, 14.1,14.2,15.6,15.7,27.8,27.9,35.1],
  [175, 14.4,14.5,15.7,15.8,26.5,26.6,33.7, 14.1,14.2,15.6,15.7,27.9,28.0,35.2],
  [176, 14.5,14.6,15.7,15.8,26.6,26.7,33.8, 14.2,14.3,15.6,15.7,28.0,28.1,35.3],
  [177, 14.5,14.6,15.8,15.9,26.7,26.8,33.9, 14.2,14.3,15.7,15.8,28.0,28.1,35.4],
  [178, 14.5,14.6,15.8,15.9,26.8,26.9,33.9, 14.2,14.3,15.7,15.8,28.1,28.2,35.4],
  [179, 14.6,14.7,15.9,16.0,26.9,27.0,34.0, 14.2,14.3,15.7,15.8,28.2,28.3,35.5],
  [180, 14.6,14.7,15.9,16.0,27.0,27.1,34.1, 14.3,14.4,15.8,15.9,28.2,28.3,35.5],
  [181, 14.6,14.7,16.0,16.1,27.1,27.2,34.1, 14.3,14.4,15.8,15.9,28.3,28.4,35.6],
  [182, 14.7,14.8,16.0,16.1,27.1,27.2,34.2, 14.3,14.4,15.8,15.9,28.4,28.5,35.7],
  [183, 14.7,14.8,16.0,16.1,27.2,27.3,34.3, 14.3,14.4,15.9,16.0,28.4,28.5,35.7],
  [184, 14.7,14.8,16.1,16.2,27.3,27.4,34.3, 14.4,14.5,15.9,16.0,28.5,28.6,35.8],
  [185, 14.8,14.9,16.1,16.2,27.4,27.5,34.4, 14.4,14.5,15.9,16.0,28.5,28.6,35.8],
  [186, 14.8,14.9,16.2,16.3,27.4,27.5,34.5, 14.4,14.5,15.9,16.0,28.6,28.7,35.8],
  [187, 14.9,15.0,16.2,16.3,27.5,27.6,34.5, 14.4,14.5,16.0,16.1,28.6,28.7,35.9],
  [188, 14.9,15.0,16.2,16.3,27.6,27.7,34.6, 14.4,14.5,16.0,16.1,28.7,28.8,35.9],
  [189, 14.9,15.0,16.3,16.4,27.7,27.8,34.6, 14.4,14.5,16.0,16.1,28.7,28.8,36.0],
  [190, 14.9,15.0,16.3,16.4,27.7,27.8,34.7, 14.5,14.6,16.0,16.1,28.8,28.9,36.0],
  [191, 15.0,15.1,16.4,16.5,27.8,27.9,34.7, 14.5,14.6,16.1,16.2,28.8,28.9,36.0],
  [192, 15.0,15.1,16.4,16.5,27.9,28.0,34.8, 14.5,14.6,16.1,16.2,28.9,29.0,36.1],
  [193, 15.0,15.1,16.4,16.5,27.9,28.0,34.8, 14.5,14.6,16.1,16.2,28.9,29.0,36.1],
  [194, 15.1,15.2,16.5,16.6,28.0,28.1,34.8, 14.5,14.6,16.1,16.2,29.0,29.1,36.1],
  [195, 15.1,15.2,16.5,16.6,28.1,28.2,34.9, 14.5,14.6,16.1,16.2,29.0,29.1,36.1],
  [196, 15.1,15.2,16.6,16.7,28.1,28.2,34.9, 14.5,14.6,16.1,16.2,29.0,29.1,36.2],
  [197, 15.2,15.3,16.6,16.7,28.2,28.3,35.0, 14.5,14.6,16.2,16.3,29.1,29.2,36.2],
  [198, 15.2,15.3,16.6,16.7,28.3,28.4,35.0, 14.6,14.7,16.2,16.3,29.1,29.2,36.2],
  [199, 15.2,15.3,16.7,16.8,28.3,28.4,35.0, 14.6,14.7,16.2,16.3,29.1,29.2,36.2],
  [200, 15.2,15.3,16.7,16.8,28.4,28.5,35.1, 14.6,14.7,16.2,16.3,29.2,29.3,36.2],
  [201, 15.3,15.4,16.7,16.8,28.5,28.6,35.1, 14.6,14.7,16.2,16.3,29.2,29.3,36.3],
  [202, 15.3,15.4,16.8,16.9,28.5,28.6,35.1, 14.6,14.7,16.2,16.3,29.2,29.3,36.3],
  [203, 15.3,15.4,16.8,16.9,28.6,28.7,35.2, 14.6,14.7,16.2,16.3,29.3,29.4,36.3],
  [204, 15.3,15.4,16.8,16.9,28.6,28.7,35.2, 14.6,14.7,16.3,16.4,29.3,29.4,36.3],
  [205, 15.4,15.5,16.9,17.0,28.7,28.8,35.2, 14.6,14.7,16.3,16.4,29.3,29.4,36.3],
  [206, 15.4,15.5,16.9,17.0,28.7,28.8,35.2, 14.6,14.7,16.3,16.4,29.3,29.4,36.3],
  [207, 15.4,15.5,16.9,17.0,28.8,28.9,35.3, 14.6,14.7,16.3,16.4,29.4,29.5,36.3],
  [208, 15.4,15.5,17.0,17.1,28.9,29.0,35.3, 14.6,14.7,16.3,16.4,29.4,29.5,36.3],
  [209, 15.5,15.6,17.0,17.1,28.9,29.0,35.3, 14.6,14.7,16.3,16.4,29.4,29.5,36.3],
  [210, 15.5,15.6,17.0,17.1,29.0,29.1,35.3, 14.6,14.7,16.3,16.4,29.4,29.5,36.3],
  [211, 15.5,15.6,17.0,17.1,29.0,29.1,35.4, 14.6,14.7,16.3,16.4,29.4,29.5,36.3],
  [212, 15.5,15.6,17.1,17.2,29.1,29.2,35.4, 14.6,14.7,16.3,16.4,29.5,29.6,36.3],
  [213, 15.5,15.6,17.1,17.2,29.1,29.2,35.4, 14.6,14.7,16.3,16.4,29.5,29.6,36.3],
  [214, 15.6,15.7,17.1,17.2,29.2,29.3,35.4, 14.6,14.7,16.3,16.4,29.5,29.6,36.3],
  [215, 15.6,15.7,17.2,17.3,29.2,29.3,35.4, 14.6,14.7,16.3,16.4,29.5,29.6,36.3],
  [216, 15.6,15.7,17.2,17.3,29.2,29.3,35.4, 14.6,14.7,16.3,16.4,29.5,29.6,36.3],
  [217, 15.6,15.7,17.2,17.3,29.3,29.4,35.4, 14.6,14.7,16.4,16.5,29.5,29.6,36.3],
  [218, 15.6,15.7,17.2,17.3,29.3,29.4,35.5, 14.6,14.7,16.4,16.5,29.6,29.7,36.3],
  [219, 15.6,15.7,17.3,17.4,29.4,29.5,35.5, 14.6,14.7,16.4,16.5,29.6,29.7,36.3],
  [220, 15.7,15.8,17.3,17.4,29.4,29.5,35.5, 14.6,14.7,16.4,16.5,29.6,29.7,36.3],
  [221, 15.7,15.8,17.3,17.4,29.5,29.6,35.5, 14.6,14.7,16.4,16.5,29.6,29.7,36.2],
  [222, 15.7,15.8,17.3,17.4,29.5,29.6,35.5, 14.6,14.7,16.4,16.5,29.6,29.7,36.2],
  [223, 15.7,15.8,17.4,17.5,29.5,29.6,35.5, 14.6,14.7,16.4,16.5,29.6,29.7,36.2],
  [224, 15.7,15.8,17.4,17.5,29.6,29.7,35.5, 14.6,14.7,16.4,16.5,29.6,29.7,36.2],
  [225, 15.7,15.8,17.4,17.5,29.6,29.7,35.5, 14.6,14.7,16.4,16.5,29.6,29.7,36.2],
  [226, 15.7,15.8,17.4,17.5,29.6,29.7,35.5, 14.6,14.7,16.4,16.5,29.6,29.7,36.2],
  [227, 15.7,15.8,17.4,17.5,29.7,29.8,35.5, 14.6,14.7,16.4,16.5,29.7,29.8,36.2],
  [228, 15.8,15.9,17.5,17.6,29.7,29.8,35.5, 14.6,14.7,16.4,16.5,29.7,29.8,36.2],
];

const BMI_TABLE_MIN_MONTHS = BMI_FOR_AGE_TABLE[0][0];
const BMI_TABLE_MAX_MONTHS = BMI_FOR_AGE_TABLE[BMI_FOR_AGE_TABLE.length - 1][0];

function calcAgeMonths(birthdate: string, referenceDate?: string): number {
  if (!birthdate) return 0;
  const birth = new Date(birthdate);
  const ref   = referenceDate ? new Date(referenceDate) : new Date();
  let months = (ref.getFullYear() - birth.getFullYear()) * 12 + (ref.getMonth() - birth.getMonth());
  if (ref.getDate() < birth.getDate()) months--;
  return Math.max(months, 0);
}

function getNutritionalStatus(bmi: number, ageMonths: number, sex: string): string {
  if (!bmi || bmi <= 0) return '—';
  const clampedMonths = Math.min(Math.max(ageMonths, BMI_TABLE_MIN_MONTHS), BMI_TABLE_MAX_MONTHS);
  const row = BMI_FOR_AGE_TABLE.find(r => r[0] === clampedMonths);
  if (!row) return '—';

  const isGirl = sex === 'F';
  const [, bSw, bWFrom, bWTo, bNFrom, bNTo, bOwFrom, bOwTo,
            gSw, gWFrom, gWTo, gNFrom, gNTo, gOwFrom, gOwTo] = row;

  const sw  = isGirl ? gSw    : bSw;
  const wF  = isGirl ? gWFrom : bWFrom;
  const wT  = isGirl ? gWTo   : bWTo;
  const nF  = isGirl ? gNFrom : bNFrom;
  const nT  = isGirl ? gNTo   : bNTo;
  const owF = isGirl ? gOwFrom: bOwFrom;
  const owT = isGirl ? gOwTo  : bOwTo;

  if (bmi <= sw)             return 'Severely Wasted';
  if (bmi >= wF && bmi <= wT) return 'Wasted';
  if (bmi >= nF && bmi <= nT) return 'Normal';
  if (bmi >= owF && bmi <= owT) return 'Overweight';
  return 'Obese';
}

function getNSColor(status: string): string {
  switch (status) {
    case 'Severely Wasted': return 'text-red-500 bg-red-950/40';
    case 'Wasted':          return 'text-orange-400 bg-orange-950/40';
    case 'Normal':          return 'text-emerald-400 bg-emerald-950/40';
    case 'Overweight':      return 'text-yellow-400 bg-yellow-950/40';
    case 'Obese':           return 'text-purple-400 bg-purple-950/40';
    default:                return 'text-gray-400';
  }
}

function getNSPrintBg(status: string): string {
  switch (status) {
    case 'Severely Wasted': return '#fee2e2';
    case 'Wasted':          return '#ffedd5';
    case 'Normal':          return '#dcfce7';
    case 'Overweight':      return '#fef9c3';
    case 'Obese':           return '#f3e8ff';
    default:                return 'white';
  }
}

function calcAge(birthdate: string, referenceDate?: string): number {
  if (!birthdate) return 0;
  const birth = new Date(birthdate);
  const ref   = referenceDate ? new Date(referenceDate) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Student { id: string; lrn: string; full_name: string; sex: string; birthdate?: string; }
interface HealthRecord {
  id:             string;
  student_id:     string;
  period:         'BEY' | 'EEY';
  date_measured:  string;
  weight_kg:      number;
  height_m:       number;
  bmi:            number;
  ns_status:      string;
  age_at_measure: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SF8Page() {
  const {
    sectionId, sectionName, gradeLevel, schoolName, schoolId,
    division, region, schoolYear, adviser, schoolHead,
  } = useActiveSection();

  const [period,   setPeriod]   = useState<'BEY'|'EEY'>('BEY');
  const [students, setStudents] = useState<Student[]>([]);
  const [records,  setRecords]  = useState<Record<string, HealthRecord>>({});
  const [editing,  setEditing]  = useState<Record<string, Partial<HealthRecord>>>({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string|null>(null);
  const [dateRef,  setDateRef]  = useState(new Date().toISOString().split('T')[0]);
  const [view,     setView]     = useState<'encode'|'sf8'>('encode');

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('students').select('*').eq('section_id', sectionId).order('full_name');
      setStudents(data ?? []);
      setLoading(false);
    })();
  }, [sectionId]);

  // ── Load health records ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('health_records').select('*')
        .eq('section_id', sectionId).eq('period', period);
      const map: Record<string, HealthRecord> = {};
      data?.forEach((r: any) => { map[r.student_id] = r; });
      setRecords(map);
      setEditing({});
    })();
  }, [sectionId, period]);

  // ── Handle input change ────────────────────────────────────────────────────
  const handleChange = (sid: string, field: string, val: string) => {
    setEditing(prev => {
      const cur = { ...(prev[sid] ?? records[sid] ?? {}) };
      (cur as any)[field] = val;
      const w = parseFloat(field === 'weight_kg' ? val : String(cur.weight_kg ?? ''));
      const h = parseFloat(field === 'height_m'  ? val : String(cur.height_m  ?? ''));
      if (w > 0 && h > 0) {
        cur.bmi = parseFloat((w / (h * h)).toFixed(2));
        const student = students.find(s => s.id === sid);
        const refDate = cur.date_measured as string || dateRef;
        const age = calcAge(student?.birthdate ?? '', refDate);
        const ageMonths = calcAgeMonths(student?.birthdate ?? '', refDate);
        cur.age_at_measure = age;
        cur.ns_status = getNutritionalStatus(cur.bmi, ageMonths, student?.sex ?? 'M');
      }
      return { ...prev, [sid]: cur };
    });
  };

  // ── Save record ────────────────────────────────────────────────────────────
  const saveRecord = async (sid: string) => {
    const data = editing[sid];
    if (!data) return;
    setSaving(sid);
    const student = students.find(s => s.id === sid);
    const payload = {
      student_id:     sid,
      section_id:     sectionId,
      period,
      school_year:    schoolYear,
      date_measured:  data.date_measured || dateRef,
      weight_kg:      parseFloat(String(data.weight_kg ?? 0)),
      height_m:       parseFloat(String(data.height_m  ?? 0)),
      bmi:            data.bmi ?? 0,
      ns_status:      data.ns_status ?? '—',
      age_at_measure: data.age_at_measure ?? calcAge(student?.birthdate ?? ''),
    };
    const { data: saved, error } = await supabase
      .from('health_records')
      .upsert(payload, { onConflict: 'student_id,period,school_year' })
      .select().single();
    if (!error && saved) {
      setRecords(prev => ({ ...prev, [sid]: saved }));
      setEditing(prev => { const n = { ...prev }; delete n[sid]; return n; });
    }
    setSaving(null);
  };

  const getVal = (sid: string, field: string) => {
    const e = editing[sid];
    const r = records[sid];
    return (e ? (e as any)[field] : (r as any)?.[field]) ?? '';
  };
  const getBMI = (sid: string) => getVal(sid, 'bmi');
  const getNS  = (sid: string) => {
    if (editing[sid]) return editing[sid].ns_status ?? '—';
    return records[sid]?.ns_status ?? '—';
  };

  // ── Enter-key navigation: moves to next student in same column ─────────────
  const handleEnter = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentId: string,
    field: 'weight_kg' | 'height_m',
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const all = Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[data-sf8="${field}"]`)
    );
    const cur  = all.findIndex(el => el.dataset.sid === studentId);
    const next = all[cur + 1];
    if (next) { next.focus(); next.select(); }
  };

  // Summary stats
  const allNS   = students.map(s => getNS(s.id)).filter(s => s !== '—');
  const countNS = (label: string) => allNS.filter(s => s === label).length;
  const males   = students.filter(s => s.sex === 'M');
  const females = students.filter(s => s.sex === 'F');

  // ─────────────────────────────────────────────────────────────────────────
  // INPUT STYLE
  // ─────────────────────────────────────────────────────────────────────────
  const numInp = 'w-24 text-center bg-transparent border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500';

  // ─────────────────────────────────────────────────────────────────────────
  // SF8 PRINT VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const SF8PrintView = () => (
    <div className="bg-white text-black p-4 font-sans" style={{fontSize:'9px', minWidth:'900px'}}>
      <div className="text-center mb-2">
        <div className="text-xs font-bold">SF 8</div>
        <div className="font-bold text-sm">Department of Education</div>
        <div className="font-bold">School Form 8 Learner's Basic Health and Nutrition Report (SF8)</div>
        <div>(For All Grade Levels)</div>
      </div>

      <table className="w-full border-collapse mb-1" style={{fontSize:'8px'}}>
        <tbody>
          <tr>
            <td className="border border-black px-1 py-0.5"><strong>School Name:</strong> {schoolName}</td>
            <td className="border border-black px-1 py-0.5"><strong>District:</strong></td>
            <td className="border border-black px-1 py-0.5"><strong>Division:</strong> {division}</td>
            <td className="border border-black px-1 py-0.5"><strong>Region:</strong> {region}</td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0.5"><strong>School ID:</strong> {schoolId}</td>
            <td className="border border-black px-1 py-0.5"><strong>Grade:</strong> {gradeLevel}</td>
            <td className="border border-black px-1 py-0.5"><strong>Section:</strong> {sectionName}</td>
            <td className="border border-black px-1 py-0.5"><strong>School Year:</strong> {schoolYear}</td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black px-1 py-0.5">
              <strong>Period:</strong> {period === 'BEY' ? 'Beginning of Year (BEY)' : 'End of Year (EEY)'}
            </td>
            <td colSpan={2} className="border border-black px-1 py-0.5">
              <strong>Date of Weighing:</strong> {dateRef}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse" style={{fontSize:'8px'}}>
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black px-0.5 py-1" rowSpan={2}>No.</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>LRN</th>
            <th className="border border-black px-1 py-1 text-left" rowSpan={2} style={{minWidth:'140px'}}>
              Learner's Name<br/>(Last Name, First Name, M.I.)
            </th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Birthdate</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Age</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Weight (kg)</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Height (m)</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Height² (m²)</th>
            <th className="border border-black text-center px-1 py-1" colSpan={2}>Nutritional Status</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Remarks</th>
          </tr>
          <tr className="bg-gray-50">
            <th className="border border-black px-1 py-0.5" style={{fontSize:'7px'}}>BMI (kg/m²)</th>
            <th className="border border-black px-1 py-0.5" style={{fontSize:'7px'}}>BMI Category</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={11} className="border border-black px-1 py-0.5 font-bold bg-blue-50">MALE</td>
          </tr>
          {males.map((student, idx) => {
            const r = records[student.id];
            const bmi = r?.bmi ?? 0;
            const ns  = r?.ns_status ?? '—';
            const h   = r?.height_m ?? 0;
            return (
              <tr key={student.id}>
                <td className="border border-black text-center">{idx+1}</td>
                <td className="border border-black px-1" style={{fontSize:'7px'}}>{student.lrn}</td>
                <td className="border border-black px-1">{student.full_name}</td>
                <td className="border border-black text-center px-1">{student.birthdate ?? ''}</td>
                <td className="border border-black text-center">{r?.age_at_measure ?? ''}</td>
                <td className="border border-black text-center">{r?.weight_kg ?? ''}</td>
                <td className="border border-black text-center">{r?.height_m ?? ''}</td>
                <td className="border border-black text-center">{h > 0 ? (h*h).toFixed(4) : ''}</td>
                <td className="border border-black text-center font-bold">{bmi > 0 ? bmi.toFixed(2) : ''}</td>
                <td className="border border-black text-center font-bold px-1"
                  style={{background: ns !== '—' ? getNSPrintBg(ns) : 'white', fontSize:'7px'}}>
                  {ns !== '—' ? ns : ''}
                </td>
                <td className="border border-black px-1"></td>
              </tr>
            );
          })}

          <tr>
            <td colSpan={11} className="border border-black px-1 py-0.5 font-bold bg-pink-50">FEMALE</td>
          </tr>
          {females.map((student, idx) => {
            const r = records[student.id];
            const bmi = r?.bmi ?? 0;
            const ns  = r?.ns_status ?? '—';
            const h   = r?.height_m ?? 0;
            return (
              <tr key={student.id}>
                <td className="border border-black text-center">{idx+1}</td>
                <td className="border border-black px-1" style={{fontSize:'7px'}}>{student.lrn}</td>
                <td className="border border-black px-1">{student.full_name}</td>
                <td className="border border-black text-center px-1">{student.birthdate ?? ''}</td>
                <td className="border border-black text-center">{r?.age_at_measure ?? ''}</td>
                <td className="border border-black text-center">{r?.weight_kg ?? ''}</td>
                <td className="border border-black text-center">{r?.height_m ?? ''}</td>
                <td className="border border-black text-center">{h > 0 ? (h*h).toFixed(4) : ''}</td>
                <td className="border border-black text-center font-bold">{bmi > 0 ? bmi.toFixed(2) : ''}</td>
                <td className="border border-black text-center font-bold px-1"
                  style={{background: ns !== '—' ? getNSPrintBg(ns) : 'white', fontSize:'7px'}}>
                  {ns !== '—' ? ns : ''}
                </td>
                <td className="border border-black px-1"></td>
              </tr>
            );
          })}

          <tr className="bg-gray-100 font-bold">
            <td colSpan={4} className="border border-black px-1 py-1">NUTRITIONAL STATUS SUMMARY</td>
            <td colSpan={2} className="border border-black text-center px-1">Severely Wasted: {countNS('Severely Wasted')}</td>
            <td colSpan={2} className="border border-black text-center px-1">Wasted: {countNS('Wasted')}</td>
            <td className="border border-black text-center">Normal: {countNS('Normal')}</td>
            <td className="border border-black text-center">Overweight: {countNS('Overweight')}</td>
            <td className="border border-black text-center">Obese: {countNS('Obese')}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex justify-between mt-4" style={{fontSize:'8px'}}>
        <div className="text-center">
          <div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>
            {adviser}<br/>Adviser / Class Teacher
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>
            School Nurse / Health Coordinator
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>
            {schoolHead || '________________________________'}
          </div>
          <div>School Head</div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER ROW (shared between male and female groups)
  // ─────────────────────────────────────────────────────────────────────────
  const renderRow = (student: Student, idx: number) => {
    const isDirty = !!editing[student.id];
    const ns      = getNS(student.id);
    const age     = editing[student.id]?.age_at_measure
      ?? records[student.id]?.age_at_measure
      ?? calcAge(student.birthdate ?? '', dateRef);

    return (
      <tr key={student.id} className="border-t border-gray-800 hover:bg-gray-900/40">
        <td className="px-3 py-2 sticky left-0 bg-gray-950 border-r border-gray-800 z-10">
          <div className="text-sm font-medium text-white">{idx+1}. {student.full_name}</div>
          <div className="text-xs text-gray-600">{student.lrn}</div>
        </td>
        <td className="text-center border-l border-gray-800 text-gray-400 text-xs">{age || '—'}</td>
        <td className="px-1 border-l border-gray-800">
          <input
            type="date"
            value={getVal(student.id, 'date_measured') || dateRef}
            onChange={e => handleChange(student.id, 'date_measured', e.target.value)}
            className="w-full bg-transparent border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
          />
        </td>
        <td className="px-1 border-l border-gray-800">
          <input
            type="number" step="0.1" min="0" placeholder="e.g. 45.5"
            value={getVal(student.id, 'weight_kg')}
            data-sf8="weight_kg"
            data-sid={student.id}
            onChange={e => handleChange(student.id, 'weight_kg', e.target.value)}
            onKeyDown={e => handleEnter(e, student.id, 'weight_kg')}
            className={numInp}
          />
        </td>
        <td className="px-1 border-l border-gray-800">
          <input
            type="number" step="0.01" min="0" placeholder="e.g. 1.52"
            value={getVal(student.id, 'height_m')}
            data-sf8="height_m"
            data-sid={student.id}
            onChange={e => handleChange(student.id, 'height_m', e.target.value)}
            onKeyDown={e => handleEnter(e, student.id, 'height_m')}
            className={numInp}
          />
        </td>
        <td className="text-center border-l border-gray-800 font-bold font-mono text-purple-300">
          {getBMI(student.id) ? Number(getBMI(student.id)).toFixed(2) : '—'}
        </td>
        <td className="text-center border-l border-gray-800 px-2">
          <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${getNSColor(ns)}`}>{ns}</span>
        </td>
        <td className="text-center border-l border-gray-800 px-2">
          {isDirty && (
            <button onClick={() => saveRecord(student.id)} disabled={saving === student.id}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition mx-auto">
              {saving === student.id ? <RefreshCw size={12} className="animate-spin"/> : <Save size={12}/>}
              Save
            </button>
          )}
        </td>
      </tr>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: landscape; margin: 8mm; }
          .sf8-screen-wrapper { display: none !important; }
          .sf8-print-only { display: block !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-950 text-white">

        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400">
              <ArrowLeft size={22}/>
            </button>
            <div>
              <h1 className="text-2xl font-bold">Health & Nutrition (SF8)</h1>
              <p className="text-gray-400 text-sm">{sectionName} · {gradeLevel} · {schoolYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              {(['BEY','EEY'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-5 py-2 text-sm font-medium transition ${period===p?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                  {p === 'BEY' ? '📅 Beginning of Year' : '📅 End of Year'}
                </button>
              ))}
            </div>
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              <button onClick={() => setView('encode')} className={`px-4 py-2 text-sm font-medium transition ${view==='encode'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>📝 Encode</button>
              <button onClick={() => setView('sf8')}   className={`px-4 py-2 text-sm font-medium transition ${view==='sf8'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>📄 SF8 Form</button>
            </div>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Printer size={16}/>Print SF8
            </button>
          </div>
        </div>

        {/* Reference date + hint */}
        <div className="no-print px-6 py-3 bg-gray-900/50 border-b border-gray-800 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Date of Weighing:</label>
            <input type="date" value={dateRef} onChange={e => setDateRef(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"/>
          </div>
          <p className="text-xs text-gray-600 italic">
            💡 Tip: Press <kbd className="bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded text-gray-400 font-mono">Enter</kbd> after typing a weight or height to jump to the next student automatically.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/> Loading...
          </div>
        ) : (
          <div className="p-6">

            {/* Summary cards */}
            <div className="no-print grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {[
                { label:'Severely Wasted', count:countNS('Severely Wasted'), color:'border-red-800 text-red-400' },
                { label:'Wasted',          count:countNS('Wasted'),          color:'border-orange-800 text-orange-400' },
                { label:'Normal',          count:countNS('Normal'),          color:'border-emerald-800 text-emerald-400' },
                { label:'Overweight',      count:countNS('Overweight'),      color:'border-yellow-800 text-yellow-400' },
                { label:'Obese',           count:countNS('Obese'),           color:'border-purple-800 text-purple-400' },
              ].map(s => (
                <div key={s.label} className={`bg-gray-900 border rounded-2xl p-4 ${s.color}`}>
                  <p className="text-gray-400 text-xs">{s.label}</p>
                  <p className={`text-3xl font-bold ${s.color.split(' ')[1]}`}>{s.count}</p>
                </div>
              ))}
            </div>

            {view === 'encode' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-0" style={{minWidth:'900px'}}>
                  <thead>
                    <tr>
                      <th className="bg-gray-800 text-left px-3 py-3 rounded-tl-xl sticky left-0 z-20 min-w-[220px]">Learner</th>
                      <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700">Age</th>
                      <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700">Date Measured</th>
                      <th className="bg-blue-900 text-center px-3 py-3 border-l border-gray-700">Weight (kg)</th>
                      <th className="bg-blue-900 text-center px-3 py-3 border-l border-gray-700">Height (m)</th>
                      <th className="bg-purple-900 text-center px-3 py-3 border-l border-gray-700">BMI</th>
                      <th className="bg-emerald-900 text-center px-3 py-3 border-l border-gray-700 min-w-[160px]">Nutritional Status</th>
                      <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700 rounded-tr-xl">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={8} className="bg-blue-950/50 px-3 py-1.5 text-blue-400 font-semibold text-xs">
                        MALE ({males.length})
                      </td>
                    </tr>
                    {males.map((s, i) => renderRow(s, i))}

                    <tr>
                      <td colSpan={8} className="bg-pink-950/50 px-3 py-1.5 text-pink-400 font-semibold text-xs">
                        FEMALE ({females.length})
                      </td>
                    </tr>
                    {females.map((s, i) => renderRow(s, i))}
                  </tbody>
                </table>
              </div>
            )}

            {view === 'sf8' && (
              <div className="sf8-screen-wrapper bg-white rounded-2xl overflow-hidden shadow-2xl">
                <SF8PrintView/>
              </div>
            )}
          </div>
        )}

        {/* Print only */}
        <div className="sf8-print-only" style={{display:'none'}}>
          <SF8PrintView/>
        </div>
      </div>
    </>
  );
}