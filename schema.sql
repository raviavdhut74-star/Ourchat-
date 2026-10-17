-- क्षण (Kshan): MySQL schema. Safe to run many times (IF NOT EXISTS).
-- Chat messages, calls and presence live in MongoDB (see backend/src/db/mongo.js).

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  email         VARCHAR(191) NOT NULL UNIQUE,
  username      VARCHAR(40)  NOT NULL UNIQUE,
  phone         VARCHAR(20)  NULL UNIQUE,
  name          VARCHAR(60)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  avatar_url    VARCHAR(500) NULL,
  bio           VARCHAR(200) NOT NULL DEFAULT '',
  is_private    TINYINT(1)   NOT NULL DEFAULT 0,
  deactivated   TINYINT(1)   NOT NULL DEFAULT 0,
  lang          VARCHAR(8)   NOT NULL DEFAULT 'mr',
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash CHAR(64)    NOT NULL PRIMARY KEY,
  user_id    CHAR(36)    NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS follows (
  follower   CHAR(36)    NOT NULL,
  followee   CHAR(36)    NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (follower, followee),
  KEY idx_followee (followee),
  FOREIGN KEY (follower) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (followee) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS follow_requests (
  requester  CHAR(36)    NOT NULL,
  target     CHAR(36)    NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (requester, target),
  KEY idx_target (target),
  FOREIGN KEY (requester) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target)    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blocks (
  blocker    CHAR(36)    NOT NULL,
  blocked    CHAR(36)    NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (blocker, blocked),
  KEY idx_blocked (blocked),
  FOREIGN KEY (blocker) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- close friends / muted / restricted lists
CREATE TABLE IF NOT EXISTS user_relations (
  user_id  CHAR(36) NOT NULL,
  other_id CHAR(36) NOT NULL,
  kind     ENUM('close','muted','restricted') NOT NULL,
  PRIMARY KEY (user_id, other_id, kind),
  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (other_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- posts (photos / videos) and reels (short videos): is_reel = 1
CREATE TABLE IF NOT EXISTS posts (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  kind       ENUM('image','video') NOT NULL,
  is_reel    TINYINT(1)   NOT NULL DEFAULT 0,
  url        VARCHAR(500) NOT NULL,
  caption    VARCHAR(300) NOT NULL DEFAULT '',
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_user (user_id, created_at),
  KEY idx_reel (is_reel, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_tags (
  post_id CHAR(36)    NOT NULL,
  tag     VARCHAR(60) NOT NULL,
  PRIMARY KEY (post_id, tag),
  KEY idx_tag (tag),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS likes (
  post_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  PRIMARY KEY (post_id, user_id),
  KEY idx_user (user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saved (
  user_id    CHAR(36)    NOT NULL,
  post_id    CHAR(36)    NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comments (
  id         CHAR(36)    NOT NULL PRIMARY KEY,
  post_id    CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  parent_id  CHAR(36)    NULL,
  text       VARCHAR(600) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_post (post_id, created_at),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  PRIMARY KEY (comment_id, user_id),
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- stories live 24 hours; close_only = visible to the author's close friends only
CREATE TABLE IF NOT EXISTS stories (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  kind       ENUM('image','video') NOT NULL,
  url        VARCHAR(500) NOT NULL,
  close_only TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS story_views (
  story_id CHAR(36)    NOT NULL,
  user_id  CHAR(36)    NOT NULL,
  seen_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (story_id, user_id),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id         CHAR(36)    NOT NULL PRIMARY KEY,
  user_id    CHAR(36)    NOT NULL,
  from_id    CHAR(36)    NOT NULL,
  type       ENUM('follow','request','accepted','like','comment','reply','clike') NOT NULL,
  post_id    CHAR(36)    NULL,
  text       VARCHAR(100) NOT NULL DEFAULT '',
  is_read    TINYINT(1)  NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_user (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS history (
  id         CHAR(36)    NOT NULL PRIMARY KEY,
  user_id    CHAR(36)    NOT NULL,
  type       ENUM('search','profile','watch') NOT NULL,
  ref_id     VARCHAR(64) NULL,
  text       VARCHAR(120) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_user (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reports (
  id         CHAR(36)    NOT NULL PRIMARY KEY,
  by_id      CHAR(36)    NOT NULL,
  type       VARCHAR(20) NOT NULL,
  target_id  VARCHAR(64) NOT NULL,
  target_uid CHAR(36)    NULL,
  reason     ENUM('spam','abusive','nudity','scam','other') NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (by_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
