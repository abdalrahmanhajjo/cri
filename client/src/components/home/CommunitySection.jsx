import { CommunityFeedStrip } from '../CommunityFeed';
import { COMMUNITY_PATH } from '../../utils/discoverPaths';

export default function CommunitySection({ posts, t }) {
  if (!posts || posts.length === 0) return null;

  return (
    <CommunityFeedStrip 
      posts={posts} 
      t={t} 
      moreTo={COMMUNITY_PATH} 
      layout="bento" 
    />
  );
}
