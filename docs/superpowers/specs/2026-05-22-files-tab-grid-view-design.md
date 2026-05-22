# Files Tab — Grid View for All Folder Types

**Date:** 2026-05-22  
**Status:** Approved  
**Scope:** `app/project/[id]/files-navigation.tsx` only

---

## Problem

The Files tab inside a project detail screen has a grid/list toggle today, but it is gated to `folder.type === 'photos'` only. When users open Receipts, Videos, or document file folders, there is no toggle — list view is the only option.

## Goal

Add the grid/list toggle to all four folder types — Photos, Receipts, Videos, and Files/Docs — so that every folder opened from the Files tab offers both views.

---

## Architecture

**Single file changed:** `app/project/[id]/files-navigation.tsx`

**State change:** Rename `photoViewMode` → `viewMode` (type `'grid' | 'list'`, default `'grid'`). This is a single shared state — switching view mode in one folder applies to all folders. This is intentional; users generally want a consistent view.

**Toggle visibility:** Remove the `folder.type === 'photos'` condition on the toggle render block (lines ~1079–1093). The toggle now renders unconditionally for all folder types.

---

## Grid Layouts

All grids use **3 columns** with equal-width square cells.

### Grid cell sizing
```
cellWidth = (screenWidth - horizontalPadding - (2 * gap)) / 3
```
Mirrors the existing `photoGrid` / `photoGridItem` pattern already in the file.

### Photos (existing — no change)
- Image thumbnail fills the cell
- Category + date overlay at bottom
- Delete button (×) top-right corner

### Receipts
| Item has image receipt | Item has PDF receipt | Item has no receipt |
|---|---|---|
| Receipt image thumbnail (square crop) | Red PDF badge icon, centered | Receipt icon (gray) |
| Store name below (1 line, truncated) | Store name below | "No receipt" label |
| Amount in small text | Amount in small text | Amount in small text |

Tap behavior: same as list — opens image viewer or PDF viewer.  
Delete: `×` button top-right, calls `handleDeleteExpenseFile(file.id)`.

### Videos
- Colored square background using `folder.color` at 20% opacity
- `Camera` icon centered (24px, `folder.color`)
- Client name below (1 line, truncated)
- No delete button (videos are inspection records, deletion not available in list view either)

Tap behavior: same as list — fetches signed URL via `/api/get-video-view-url`, opens with `Linking.openURL`.

### Files / Documents
| File is an image | File is PDF or other |
|---|---|
| Image thumbnail (square crop) | File-type icon centered (`FileIcon`, `folder.color`) |
| Filename below (1 line, truncated) | Filename below (1 line, truncated) |

Tap behavior: same as list — image viewer, `window.open` for PDF on web, `Linking.openURL` for native.  
Delete: `×` button top-right, calls `handleDeleteDocument(file.id)` (same as list).

---

## New Styles

```
gridContainer     — flexWrap: 'wrap', flexDirection: 'row', gap: 8, padding: 12
gridItem          — width: (width-40)/3, aspectRatio: 1, borderRadius: 8, overflow: 'hidden'
gridItemImage     — width: '100%', height: '100%'
gridItemIconBg    — flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8
gridItemLabel     — fontSize: 11, color: '#374151', marginTop: 4, numberOfLines: 1
gridItemSubLabel  — fontSize: 10, color: '#6B7280'
gridDeleteBtn     — position: 'absolute', top: 4, right: 4, bg: rgba(0,0,0,0.5), borderRadius: 10, padding: 3
```

All new style names follow the existing `photoGrid*` naming convention already in the file.

---

## What Does NOT Change

- `(tabs)/photos.tsx` — main Photos tab already has grid/list, untouched
- `project/[id]/expenses.tsx` — project Expenses tab is a separate screen, out of scope
- Toggle icon, colors, and active state styling — reused exactly from existing implementation
- All tap handlers, delete handlers, image viewers — no logic changes

---

## Acceptance Criteria

1. Opening Photos folder → grid/list toggle visible, grid works (unchanged)
2. Opening Receipts folder → grid/list toggle visible; image receipts show thumbnail; PDFs show icon; all show store + amount
3. Opening Videos folder → grid/list toggle visible; each cell shows camera icon + client name; tap opens video
4. Opening any document folder → grid/list toggle visible; image files show thumbnail; other files show icon + filename
5. Switching view mode in one folder is reflected when navigating to another folder in the same session
6. Delete buttons functional in grid mode for receipts and files
7. No regression in list view for any folder type
