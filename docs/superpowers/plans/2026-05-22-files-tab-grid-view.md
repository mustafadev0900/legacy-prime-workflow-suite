# Files Tab Grid View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a grid/list toggle to every folder type (Receipts, Videos, Files/Docs, Photos) in the project detail Files tab.

**Architecture:** All changes live in a single file — `app/project/[id]/files-navigation.tsx`. The existing `photoViewMode` state and toggle UI are extended to cover all folder types by: (1) renaming the state to `viewMode`, (2) removing the `folder.type === 'photos'` gate on the toggle, and (3) adding parallel grid-render blocks for Receipts, Videos, and Document folders alongside the already-implemented Photos grid.

**Tech Stack:** React Native, Expo Image, lucide-react-native, TypeScript

---

## File Map

| File | Change |
|---|---|
| `app/project/[id]/files-navigation.tsx` | Only file changed — rename state, ungating toggle, add 3 grid blocks + styles |

---

## Task 1: Rename `photoViewMode` → `viewMode` and show toggle for all folder types

**Files:**
- Modify: `app/project/[id]/files-navigation.tsx:117,1079–1094`

- [ ] **Step 1: Rename state declaration (line 117)**

Replace:
```tsx
const [photoViewMode, setPhotoViewMode] = useState<'grid' | 'list'>('grid');
```
With:
```tsx
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
```

- [ ] **Step 2: Rename all 6 remaining `photoViewMode` / `setPhotoViewMode` references**

Use find-and-replace (replace_all) for each:

| Old | New |
|---|---|
| `photoViewMode` | `viewMode` |
| `setPhotoViewMode` | `setViewMode` |

After this change lines 1082–1091 become:
```tsx
style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
onPress={() => setViewMode('grid')}
...
<LayoutGrid size={16} color={viewMode === 'grid' ? '#2563EB' : '#9CA3AF'} />
...
style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
onPress={() => setViewMode('list')}
...
<LayoutList size={16} color={viewMode === 'list' ? '#2563EB' : '#9CA3AF'} />
```

- [ ] **Step 3: Remove the `folder.type === 'photos'` gate on the toggle**

Current block (lines 1079–1094):
```tsx
{folder.type === 'photos' && (
  <View style={styles.viewToggle}>
    <TouchableOpacity
      style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
      onPress={() => setViewMode('grid')}
    >
      <LayoutGrid size={16} color={viewMode === 'grid' ? '#2563EB' : '#9CA3AF'} />
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
      onPress={() => setViewMode('list')}
    >
      <LayoutList size={16} color={viewMode === 'list' ? '#2563EB' : '#9CA3AF'} />
    </TouchableOpacity>
  </View>
)}
```

Replace with (remove the outer conditional — toggle always renders):
```tsx
<View style={styles.viewToggle}>
  <TouchableOpacity
    style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
    onPress={() => setViewMode('grid')}
  >
    <LayoutGrid size={16} color={viewMode === 'grid' ? '#2563EB' : '#9CA3AF'} />
  </TouchableOpacity>
  <TouchableOpacity
    style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
    onPress={() => setViewMode('list')}
  >
    <LayoutList size={16} color={viewMode === 'list' ? '#2563EB' : '#9CA3AF'} />
  </TouchableOpacity>
</View>
```

- [ ] **Step 4: Verify the app builds with no TypeScript errors**

```bash
bun run lint
```
Expected: no errors related to `photoViewMode` or `setPhotoViewMode`.

- [ ] **Step 5: Commit**

```bash
git add "app/project/[id]/files-navigation.tsx"
git commit -m "feat: extend files tab view toggle to all folder types"
```

---

## Task 2: Add shared grid styles for non-photo folder types

**Files:**
- Modify: `app/project/[id]/files-navigation.tsx` — StyleSheet block after `photoGridDeleteBtn` (around line 2340)

- [ ] **Step 1: Add new styles after the `photoGridDeleteBtn` style block**

Locate this exact closing brace in the StyleSheet (around line 2340):
```tsx
  photoGridDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(239,68,68,0.85)',
    borderRadius: 14,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Category chevron
```

Insert these new styles between `photoGridDeleteBtn` and `// Category chevron`:
```tsx
  fileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 4,
    paddingBottom: 8,
  },
  fileGridItem: {
    width: '31%',
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  fileGridImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#E5E7EB',
  },
  fileGridIconBg: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  fileGridMeta: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  fileGridLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  fileGridSubLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  fileGridDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(239,68,68,0.85)',
    borderRadius: 14,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
```

- [ ] **Step 2: Verify no lint errors**

```bash
bun run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/project/[id]/files-navigation.tsx"
git commit -m "feat: add shared grid styles for files tab folder types"
```

---

## Task 3: Add grid rendering for Receipts folder

**Files:**
- Modify: `app/project/[id]/files-navigation.tsx` — around lines 1113–1162

The Photos grid is rendered as a separate block before `displayedFiles.map()`. Do the same for Receipts.

- [ ] **Step 1: Add the receipts grid block**

Locate the existing photos list block ending (around line 1158–1159):
```tsx
          {folder.type === 'photos' && viewMode === 'list' && (
            <View>
              {displayedFiles.map((file: any) => (
                ...
              ))}
            </View>
          )}
          {displayedFiles.map((file: any) => {
```

Insert the following receipts grid block between the photos list block and `{displayedFiles.map(`:

```tsx
          {folder.type === 'receipts' && viewMode === 'grid' && (
            <View style={styles.fileGrid}>
              {displayedFiles.map((file: any) => {
                const isPdf = file.receiptUrl
                  ? file.receiptUrl.toLowerCase().includes('.pdf') ||
                    file.receiptUrl.toLowerCase().includes('application/pdf')
                  : false;
                const hasImageReceipt = file.receiptUrl && !isPdf;
                return (
                  <View key={file.id} style={styles.fileGridItem}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (!file.receiptUrl) {
                          Alert.alert('No Receipt', 'This expense does not have a receipt image attached.');
                          return;
                        }
                        if (isPdf) {
                          setViewingFile({ uri: file.receiptUrl, name: `${file.store} - $${file.amount.toFixed(2)}`, type: 'pdf' });
                        } else {
                          const imageReceipts = files.filter((e: any) => {
                            const url = (e.receiptUrl || '').toLowerCase();
                            return e.receiptUrl && !url.includes('.pdf') && !url.includes('application/pdf');
                          });
                          openImageFullScreen(expenseToViewable(file), imageReceipts.map(expenseToViewable));
                        }
                      }}
                    >
                      {hasImageReceipt ? (
                        <Image source={{ uri: file.receiptUrl }} style={styles.fileGridImage} contentFit="cover" />
                      ) : (
                        <View style={styles.fileGridIconBg}>
                          {isPdf
                            ? <FileIcon size={28} color="#DC2626" />
                            : <Receipt size={28} color="#9CA3AF" />}
                        </View>
                      )}
                      <View style={styles.fileGridMeta}>
                        <Text style={styles.fileGridLabel} numberOfLines={1}>{file.store}</Text>
                        <Text style={styles.fileGridSubLabel}>${file.amount.toLocaleString()}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.fileGridDeleteBtn} onPress={() => handleDeleteExpenseFile(file.id)}>
                      <Trash2 size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
```

- [ ] **Step 2: Skip receipts in `displayedFiles.map()` when in grid mode**

Inside `displayedFiles.map()`, locate the receipts branch (the `else if (folder.type === 'receipts')` block). It currently starts with:
```tsx
            } else if (folder.type === 'receipts') {
              return (
                <View key={file.id} style={[styles.expenseCard, { position: 'relative' }]}>
```

Add an early return before the existing return:
```tsx
            } else if (folder.type === 'receipts') {
              if (viewMode === 'grid') return null;
              return (
                <View key={file.id} style={[styles.expenseCard, { position: 'relative' }]}>
```

- [ ] **Step 3: Verify lint**

```bash
bun run lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/project/[id]/files-navigation.tsx"
git commit -m "feat: add grid view for receipts folder in files tab"
```

---

## Task 4: Add grid rendering for Videos folder

**Files:**
- Modify: `app/project/[id]/files-navigation.tsx` — after receipts grid block

- [ ] **Step 1: Add the videos grid block**

Immediately after the receipts grid block you added in Task 3 (still before `{displayedFiles.map(`), insert:

```tsx
          {folder.type === 'videos' && viewMode === 'grid' && (
            <View style={styles.fileGrid}>
              {displayedFiles.map((file: any) => (
                <TouchableOpacity
                  key={file.id}
                  style={styles.fileGridItem}
                  activeOpacity={0.8}
                  onPress={async () => {
                    try {
                      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
                      const response = await fetch(`${apiUrl}/api/get-video-view-url?videoKey=${encodeURIComponent(file.videoUrl)}`);
                      if (!response.ok) throw new Error('Failed to get video URL');
                      const result = await response.json();
                      if (result.viewUrl) Linking.openURL(result.viewUrl);
                    } catch (error: any) {
                      console.error('[Videos] Error loading video:', error);
                      Alert.alert('Error', error.message || 'Failed to load video');
                    }
                  }}
                >
                  <View style={[styles.fileGridIconBg, { backgroundColor: `${folder.color}20` }]}>
                    <Camera size={28} color={folder.color} />
                  </View>
                  <View style={styles.fileGridMeta}>
                    <Text style={styles.fileGridLabel} numberOfLines={1}>{file.clientName}</Text>
                    <Text style={styles.fileGridSubLabel}>{new Date(file.completedAt || file.createdAt).toLocaleDateString()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
```

- [ ] **Step 2: Skip videos in `displayedFiles.map()` when in grid mode**

Inside `displayedFiles.map()`, locate the videos branch. It currently starts with:
```tsx
            } else if (folder.type === 'videos') {
              return (
                <TouchableOpacity
                  key={file.id}
                  style={styles.documentCard}
```

Add an early return:
```tsx
            } else if (folder.type === 'videos') {
              if (viewMode === 'grid') return null;
              return (
                <TouchableOpacity
                  key={file.id}
                  style={styles.documentCard}
```

- [ ] **Step 3: Verify lint**

```bash
bun run lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/project/[id]/files-navigation.tsx"
git commit -m "feat: add grid view for videos folder in files tab"
```

---

## Task 5: Add grid rendering for Documents/Files folder

**Files:**
- Modify: `app/project/[id]/files-navigation.tsx` — after videos grid block

- [ ] **Step 1: Add the documents grid block**

Immediately after the videos grid block (still before `{displayedFiles.map(`), insert:

```tsx
          {folder.type !== 'photos' && folder.type !== 'receipts' && folder.type !== 'videos' && viewMode === 'grid' && (
            <View style={styles.fileGrid}>
              {displayedFiles.map((file: any) => {
                const isImage = file.fileType?.startsWith('image/');
                const isPdf = file.fileType === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
                const fileUrl = file.uri;
                return (
                  <View key={file.id} style={styles.fileGridItem}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (isImage) {
                          const imageFiles = files.filter((f: any) => f.fileType?.startsWith('image/'));
                          openImageFullScreen(projectFileToViewable(file), imageFiles.map(projectFileToViewable));
                        } else if (isPdf && Platform.OS === 'web') {
                          window.open(fileUrl, '_blank');
                        } else {
                          Linking.openURL(fileUrl).catch(() => {
                            Alert.alert('Cannot Open', 'Unable to open this file type on this device.');
                          });
                        }
                      }}
                    >
                      {isImage ? (
                        <Image source={{ uri: fileUrl }} style={styles.fileGridImage} contentFit="cover" />
                      ) : (
                        <View style={[styles.fileGridIconBg, { backgroundColor: `${folder.color}20` }]}>
                          <FileIcon size={28} color={folder.color} />
                        </View>
                      )}
                      <View style={styles.fileGridMeta}>
                        <Text style={styles.fileGridLabel} numberOfLines={1}>{file.name}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.fileGridDeleteBtn} onPress={() => handleDeleteDocument(file.id)}>
                      <Trash2 size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
```

- [ ] **Step 2: Skip documents in `displayedFiles.map()` when in grid mode**

Inside `displayedFiles.map()`, find the final `else` branch (handles all document types). It currently starts with:
```tsx
            } else {
              const isImage = file.fileType?.startsWith('image/');
              const isPdf = file.fileType === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
              const fileUrl = file.uri;
              return (
                <View key={file.id} style={[styles.documentCard, { position: 'relative' }]}>
```

Add an early return:
```tsx
            } else {
              if (viewMode === 'grid') return null;
              const isImage = file.fileType?.startsWith('image/');
              const isPdf = file.fileType === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
              const fileUrl = file.uri;
              return (
                <View key={file.id} style={[styles.documentCard, { position: 'relative' }]}>
```

- [ ] **Step 3: Verify lint**

```bash
bun run lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/project/[id]/files-navigation.tsx"
git commit -m "feat: add grid view for document folders in files tab"
```

---

## Task 6: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
bun run start:local
```
Or web-only:
```bash
bunx expo start --web
```

- [ ] **Open the Files tab in any project and verify each folder:**

| Folder | Check |
|---|---|
| Photos | Grid shows square thumbnails with category/date overlay; list shows row cards — unchanged |
| Receipts | Grid shows image thumbnail (or PDF/receipt icon) + store + amount; list view unchanged |
| Videos | Grid shows camera icon on colored bg + client name + date; list view unchanged |
| Files/Docs | Grid shows image thumbnail or file icon + filename; list view unchanged |

- [ ] **Verify toggle button appears for every folder type** — LayoutGrid / LayoutList icons visible in header.

- [ ] **Verify delete buttons work in grid mode** — tap the red × on a receipt grid cell and confirm it deletes.

- [ ] **Verify tap handlers work in grid mode** — tapping a receipt image opens the full-screen viewer; tapping a PDF receipt opens the PDF viewer.
