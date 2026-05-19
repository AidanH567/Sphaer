-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  disciplines TEXT[] DEFAULT '{}',
  location TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Circles
CREATE TABLE circles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  location_name TEXT,
  address TEXT,
  lat FLOAT,
  lng FLOAT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  categories TEXT[] DEFAULT '{}',
  poster_url TEXT,
  ticket_url TEXT,
  is_free BOOLEAN DEFAULT TRUE,
  price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Circle members
CREATE TABLE circle_members (
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (circle_id, user_id)
);

-- Follows (user → user)
CREATE TABLE follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Circle follows (user → circle)
CREATE TABLE circle_follows (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, circle_id)
);

-- Saved events
CREATE TABLE saved_events (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (recipient_id IS NOT NULL AND circle_id IS NULL) OR
    (recipient_id IS NULL AND circle_id IS NOT NULL)
  )
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('follow', 'event_reminder', 'circle_event', 'message')) NOT NULL,
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, owner can update
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Events: anyone can read, owner can write
CREATE POLICY "events_read_all" ON events FOR SELECT USING (TRUE);
CREATE POLICY "events_insert_own" ON events FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "events_update_own" ON events FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "events_delete_own" ON events FOR DELETE USING (auth.uid() = creator_id);

-- Circles: public circles readable by all
CREATE POLICY "circles_read_public" ON circles FOR SELECT USING (is_public = TRUE OR auth.uid() = creator_id);
CREATE POLICY "circles_insert_own" ON circles FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "circles_update_own" ON circles FOR UPDATE USING (auth.uid() = creator_id);

-- Circle members
CREATE POLICY "circle_members_read" ON circle_members FOR SELECT USING (TRUE);
CREATE POLICY "circle_members_insert" ON circle_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "circle_members_delete" ON circle_members FOR DELETE USING (auth.uid() = user_id);

-- Follows
CREATE POLICY "follows_read_all" ON follows FOR SELECT USING (TRUE);
CREATE POLICY "follows_insert_own" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Circle follows
CREATE POLICY "circle_follows_read" ON circle_follows FOR SELECT USING (TRUE);
CREATE POLICY "circle_follows_insert" ON circle_follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "circle_follows_delete" ON circle_follows FOR DELETE USING (auth.uid() = user_id);

-- Saved events
CREATE POLICY "saved_events_own" ON saved_events FOR ALL USING (auth.uid() = user_id);

-- Messages: participants only
CREATE POLICY "messages_read" ON messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = recipient_id OR
  EXISTS (SELECT 1 FROM circle_members WHERE circle_id = messages.circle_id AND user_id = auth.uid())
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Notifications: own only
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
