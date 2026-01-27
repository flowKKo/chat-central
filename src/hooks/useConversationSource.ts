import { useAtom } from 'jotai'
import {
  conversationsAtom,
  favoritesConversationsAtom,
  filteredConversationCountsAtom,
  filteredFavoriteCountsAtom,
  favoritesPaginationAtom,
  isLoadingConversationsAtom,
  isLoadingFavoritesAtom,
  loadConversationDetailAtom,
  loadConversationsAtom,
  loadFavoriteDetailAtom,
  loadFavoritesAtom,
  paginationAtom,
} from '@/utils/atoms'

/**
 * Select the correct set of conversation atoms based on view mode.
 * Reduces repeated ternary atom selections in ConversationsManager.
 */
export function useConversationSource(isFavorites: boolean) {
  const [conversations] = useAtom(isFavorites ? favoritesConversationsAtom : conversationsAtom)
  const [counts] = useAtom(
    isFavorites ? filteredFavoriteCountsAtom : filteredConversationCountsAtom
  )
  const [, loadConversations] = useAtom(isFavorites ? loadFavoritesAtom : loadConversationsAtom)
  const [, loadDetail] = useAtom(isFavorites ? loadFavoriteDetailAtom : loadConversationDetailAtom)
  const [pagination] = useAtom(isFavorites ? favoritesPaginationAtom : paginationAtom)
  const [isLoading] = useAtom(isFavorites ? isLoadingFavoritesAtom : isLoadingConversationsAtom)

  return { conversations, counts, loadConversations, loadDetail, pagination, isLoading }
}
