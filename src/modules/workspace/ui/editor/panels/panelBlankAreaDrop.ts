export function isPanelBlankAreaDropTarget(input: {
  hitPanelDropZone: boolean;
  pointY: number;
  lastVisibleRowBottom: number | null;
}) {
  const { hitPanelDropZone, pointY, lastVisibleRowBottom } = input;

  if (!hitPanelDropZone || lastVisibleRowBottom == null) {
    return false;
  }

  return pointY >= lastVisibleRowBottom;
}
