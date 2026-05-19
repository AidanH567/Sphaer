export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  berlin: {
    lat: 52.52,
    lng: 13.405,
    latitudeDelta: 0.12,
    longitudeDelta: 0.06,
  },
} as const;
