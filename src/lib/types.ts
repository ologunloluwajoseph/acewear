// Shared client-side DTOs (mirror API responses)

export interface UserBrief {
  id: number
  username: string
  firstName: string | null
  avatarUrl: string | null
  isVerified: boolean
  isPro?: boolean
}

export interface PostDTO {
  id: number
  body: string | null
  mediaUrl: string | null
  mediaType: string
  category: string
  likesCount: number
  dislikesCount: number
  resharesCount: number
  commentsCount: number
  votesCount: number
  createdAt: string
  user: UserBrief
  contest?: { id: number; title: string; slug: string } | null
  likedByMe: boolean
  dislikedByMe: boolean
  resharedByMe: boolean
  votedByMe: boolean
  bookmarkedByMe: boolean
  tagged: UserBrief[]
  /** populated when this post is a repost of another post */
  originalPost?: {
    id: number
    body: string | null
    mediaUrl: string | null
    mediaType: string
    createdAt: string
    user: UserBrief
  } | null
}

export interface ReelDTO {
  id: number
  caption: string | null
  mediaUrl: string
  mediaType: 'video' | 'image' | string
  posterUrl: string | null
  soundLabel: string | null
  viewsCount: number
  likesCount: number
  createdAt: string
  user: UserBrief
  likedByMe: boolean
}

export interface CommentDTO {
  id: number
  postId: number
  userId: number
  body: string
  createdAt: string
  user: UserBrief
}

export interface StoryItemDTO {
  id: number
  mediaUrl: string | null
  body: string | null
  backgroundColor: string
  viewsCount: number
  viewedByMe: boolean
  createdAt: string
  expiresAt: string
}

export interface StoryGroupDTO {
  user: UserBrief
  stories: StoryItemDTO[]
  allViewed: boolean
}

export type ContestPhase = 'upcoming' | 'active' | 'voting' | 'completed'

export interface ContestDTO {
  id: number
  title: string
  slug: string
  description: string | null
  category: string
  coverUrl: string | null
  prize: string | null
  startsAt: string
  endsAt: string
  votingEndsAt: string
  tier: string
  entriesCount: number
  totalVotes: number
  winner: UserBrief | null
  joinedByMe: boolean
  phase: ContestPhase
}

export interface EntryDTO {
  id: number
  caption: string
  imageUrl: string | null
  votesCount: number
  createdAt: string
  user: UserBrief
  votedByMe: boolean
}

export interface ProductDTO {
  id: number
  name: string
  description: string
  priceCoins: number
  image: string | null
  category: string
  stock: number
  rating: number | null
  reviewsCount: number
  soldCount: number
}

export interface ReviewDTO {
  id: number
  productId: number
  userId: number
  rating: number
  body: string
  verified: boolean
  createdAt: string
  user: UserBrief
}

export interface ConversationDTO {
  id: number
  other: UserBrief
  lastMessage: { body: string; senderId: number; createdAt: string; isRead: boolean } | null
  unreadCount: number
}

export interface MessageDTO {
  id: number
  conversationId: number
  senderId: number
  body: string
  isRead: boolean
  createdAt: string
}

export interface NotificationDTO {
  id: number
  userId: number
  actorId: number | null
  type: string
  targetType: string | null
  targetId: number | null
  text: string
  link: string | null
  isRead: boolean
  createdAt: string
  actor?: UserBrief | null
}

export interface ProfileDTO {
  id: number
  username: string
  firstName: string | null
  bio: string | null
  avatarUrl: string | null
  coverUrl: string | null
  isVerified: boolean
  isPro: boolean
  isAdmin: boolean
  trustScore: number
  streakCount: number
  createdAt: string
  following: boolean
  followedBy: boolean
  // Task 23 — shadow-block state between the viewer and this profile
  blockedByMe?: boolean
  blocksMe?: boolean
  _count: {
    posts: number
    followers: number
    following: number
    contestsWon: number
  }
}

export interface RealtimeMessagePayload {
  id: number
  conversationId: number
  senderId: number
  senderUsername: string
  senderFirstName: string | null
  senderAvatar: string | null
  recipientId: number
  body: string
  createdAt: string
}
