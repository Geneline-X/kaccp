# Step 4 - Hardcoded Text Replacement Complete

**Date:** February 7, 2026  
**Status:** ✅ Complete - All hardcoded UI text replaced with translation keys

---

## Summary of Changes

**Total Replacements Made:** 4  
**Files Updated:** 4  
**Pattern Used:** Existing `t()` function from `useTranslations()` hook

---

## Detailed Changes

### 1. **`src/app/[locale]/transcriber/login/page.tsx`** - Line 71

**Before:**
```tsx
placeholder="email@example.com or +232..."
```

**After:**
```tsx
placeholder={t('auth.emailOrPhonePlaceholder')}
```

**Translation Key:** `auth.emailOrPhonePlaceholder`  
**Value:** `"email@example.com or +232..."`  
**Impact:** Email/phone input placeholder now translatable

---

### 2. **`src/app/[locale]/transcriber/profile/page.tsx`** - Line 111

**Before:**
```tsx
<Input id="phone" placeholder="e.g. +232 76 123 456" value={phone} ... />
```

**After:**
```tsx
<Input id="phone" placeholder={t('transcriber.phoneExample')} value={phone} ... />
```

**Translation Key:** `transcriber.phoneExample`  
**Value:** `"e.g. +232 76 123 456"`  
**Impact:** Phone example placeholder now translatable across all languages

---

### 3. **`src/app/[locale]/transcriber/v2/register/page.tsx`** - Line 159

**Before:**
```tsx
placeholder="+232 XX XXX XXXX"
```

**After:**
```tsx
placeholder={t('auth.phoneFormatExample')}
```

**Translation Key:** `auth.phoneFormatExample`  
**Value:** `"+232 XX XXX XXXX"`  
**Impact:** Phone format hint placeholder now translatable

---

### 4. **`src/app/[locale]/speaker/record/page.tsx`** - Line 418

**Before:**
```tsx
{duration.toFixed(1)}s
```

**After:**
```tsx
{duration.toFixed(1)}{t('common.secondsShort')}
```

**Translation Key:** `common.secondsShort`  
**Value:** `"s"`  
**Impact:** Duration unit suffix now translatable (supports abbreviations in different languages)

---

## Implementation Details

### Approach Used
- ✅ Used existing `useTranslations()` hook (already imported in all files)
- ✅ No new imports added
- ✅ No runtime translation API calls
- ✅ Leveraged translation keys created in Step 3

### Translation Keys Utilized

| Key | File | English Value |
|-----|------|---|
| `auth.emailOrPhonePlaceholder` | transcriber/login | `"email@example.com or +232..."` |
| `transcriber.phoneExample` | transcriber/profile | `"e.g. +232 76 123 456"` |
| `auth.phoneFormatExample` | transcriber/v2/register | `"+232 XX XXX XXXX"` |
| `common.secondsShort` | speaker/record | `"s"` |

---

## Verification Status

✅ All hardcoded strings replaced with translation keys  
✅ All files successfully updated  
✅ Translation keys exist in English JSON files (Step 3)  
✅ Each placeholder uses `t()` function with correct key  
✅ Code syntax remains valid and compilable  

---

## What's Left

The following hardcoded elements were NOT replaced (as they are acceptable):

**Visual Elements (acceptable as-is):**
- Navigation arrows: `←`, `→`
- Separators: `•`, `|`
- Emoji indicators: `💡`, `🚩`
- Password placeholder: `••••••••` (universal convention)

**Why:** These are either universal visual conventions or provide minimal localization value. Translating them would complicate the code without significant UX benefit.

---

## Testing Checklist

To verify the changes work correctly:

- [ ] Test transcriber login with different locales - phone placeholder should translate
- [ ] Test transcriber profile form - phone example should translate
- [ ] Test transcriber V2 registration - phone format should translate
- [ ] Test speaker recording - duration unit should display correct abbreviation per locale
- [ ] Verify all translations exist in language files (de, es, fr, it, zh)

---

## Files Ready for Translation

All 4 updated files are now ready for localization. The translation teams can add translations for these keys to all language files:
- `src/messages/de/common.json` - `common.secondsShort`, `auth.emailOrPhonePlaceholder`, `auth.phoneFormatExample`
- `src/messages/de/transcriber.json` - `transcriber.phoneExample`
- (Same for es, fr, it, zh)

---

## Next Steps

1. **Translate to Other Languages** - Add translations for the 4 new keys to all language files
2. **Test Localization** - Verify placeholders display correctly in each language
3. **Language-Specific Variants** - Consider if phone format examples need country-specific variations
4. **Documentation** - Update any UI documentation with proper translation key references

