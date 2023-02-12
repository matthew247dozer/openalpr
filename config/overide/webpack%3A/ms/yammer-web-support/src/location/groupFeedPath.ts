import { getDefaultSubtype } from '@ms/yammer-data/dist/domains/feeds/getId';
import { GroupFeedType } from '@ms/yammer-data/dist/normalization/types';
import { Feed, FeedType } from '@ms/yammer-data/dist/state/types';

import { trimBasenameFromUrlPath } from './trimBasenameFromUrlPath';
import { trimLeadingSlash } from './urlRootPath';

type GroupFeedSubtypePath = 'all' | 'new' | 'questions' | 'unanswered';
const groupFeedSubtypesMap: Record<GroupFeedSubtypePath, GroupFeedType> = {
  all: GroupFeedType.ALL,
  new: GroupFeedType.UNSEEN,
  questions: GroupFeedType.QUESTIONS,
  unanswered: GroupFeedType.UNANSWERED_QUESTIONS,
};

interface EntityIdAndSubtype {
  readonly entityId: Feed['id'];
  readonly subtype: GroupFeedType;
}
type GetGroupFeedEntityIdAndSubtype = (urlPath: string) => EntityIdAndSubtype | undefined;
export const getGroupFeedEntityIdAndSubtype: GetGroupFeedEntityIdAndSubtype = (urlPath) => {
  const urlPathWithoutBasename = trimBasenameFromUrlPath(urlPath);
  const trimmedUrlPath = trimLeadingSlash(urlPathWithoutBasename);
  const pathParts = trimmedUrlPath.split('/');

  if (pathParts.length === 2) {
    const defaultSubtype = getDefaultSubtype(FeedType.Group) as GroupFeedType;

    return { entityId: pathParts[1], subtype: defaultSubtype };
  }

  if (pathParts.length === 3) {
    const subtype = groupFeedSubtypesMap[pathParts[2] as GroupFeedSubtypePath];
    if (subtype) {
      return { entityId: pathParts[1], subtype };
    }
  }
};
