# Team Quest Data Guide

`frontend/public/seichi_data.json` にスポットを追加すると、`quests` を持つスポットだけが Quest Home に表示されます。

## 基本方針

- 担当者ごとの優先表示はしない。
- どの担当アニメも同じデータ形式で追加する。
- `quest_order` は任意。発表用に全体の並びを決めたい時だけチームで番号を決める。
- `quest_order` がない場合は、作品名とスポット名で自然に並ぶ。
- 1スポットにつき `quests` は最大3件まで画面に出る。

## 追加テンプレート

```json
{
  "id": "anime-location-01",
  "spot_name_ja": "日本語スポット名",
  "spot_name_en": "English Spot Name",
  "anime_title_ja": "日本語作品名",
  "anime_title_en": "English Anime Title",
  "scene_description": "作中での意味や、なぜ巡礼対象なのか。",
  "intro_short_en": "Short English introduction for visitors.",
  "lat": 35.0000,
  "lng": 139.0000,
  "area": "Kanagawa",
  "nearest_station": "Nearest Station",
  "access_note": "アクセスメモ",
  "photo_url": "/quest-assets/example.jpg",
  "tags": ["walkable", "photo-spot", "free", "outdoor"],
  "verified": true,
  "source": "",
  "generic_intro_en": "",
  "official_url": "",
  "hours": "Always open",
  "quest_title": "Quest Title",
  "quest_place": "表示したい場所名",
  "quest_type": "Photo Route",
  "quests": [
    {
      "category": "Visit",
      "title": "訪れる",
      "description": "現地でやること。",
      "photo_prompt": "Upload a photo from this stop.",
      "impression_prompt": "Write one short memory."
    }
  ]
}
```

## 画像

画像を使う場合は `frontend/public/quest-assets/` に置き、`photo_url` は `/quest-assets/ファイル名.jpg` の形にします。

## Drive Mode

現状の Drive Mode は `hakone-initiald-01` 専用です。他の作品で専用モードを足す場合は、通常の `quests` とは別にUI実装が必要です。
