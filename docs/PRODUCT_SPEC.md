# LIKEPASS 実装仕様書

- Version: 0.1
- Status: MVP Planning
- Primary development environment: Cursor
- Repository: GitHub
- Application hosting: Render
- Image storage and delivery: Cloudflare R2 / Cloudflare CDN
- Authentication: Google Account
- Primary database: PostgreSQL
- Language: TypeScript
- Target: Responsive Web Application / PWA-ready

---

## 1. ドキュメントの目的

本書は、写真評価サービス「LIKEPASS」をCursorで設計・実装するための統合仕様書である。

Cursorは、本書をプロジェクトの一次仕様として参照し、以下を実施する。

1. 要件を満たすアプリケーション設計
2. データベーススキーマ作成
3. APIおよび画面実装
4. ランキングアルゴリズム実装
5. 画像AIによるタグ生成
6. 低品質コンテンツの配信抑制
7. Googleアカウント認証
8. テスト・CI/CD・デプロイ設定
9. セキュリティ、モデレーション、監視

仕様に曖昧さがある場合、Cursorは以下の優先順位で判断する。

1. ユーザーが良質な写真に出会えること
2. 評価結果の公平性と信頼性
3. 評価体験の単純さ
4. 投稿者と評価者の安全性
5. MVPとしての実装容易性
6. 将来的な拡張性

---

# 2. サービス概要

## 2.1 サービス名

**LIKEPASS**

## 2.2 サービスコンセプト

> 素敵な画像を、みんなの審美眼で見つける。

LIKEPASSは、投稿された写真に対して、ユーザーが「LIKE」または「PASS」の二択で評価するサービスである。

評価結果から写真のLIKE率と信頼度を計算し、AIが付与したハッシュタグごとにランキングを形成する。

一般的なSNSのように、フォロワー数、知名度、コメント数、投稿者の影響力を主要なランキング要因にはしない。写真そのものに対する評価を中心にする。

## 2.3 コアバリュー

- 良質な写真を発見できる
- 評価操作がLIKEまたはPASSだけで簡単
- 評価に参加することでランキングが開放される
- PASSもサービス品質向上への貢献になる
- AIによって投稿整理の負担を減らす
- 投稿者の知名度ではなく写真自体が評価される

---

# 3. プロダクト原則

## 3.1 写真中心

評価画面では、投稿者名、LIKE数、順位、コメントなど、判断にバイアスを与える情報を評価前に表示しない。

## 3.2 二択

評価は以下の二択に限定する。

- `LIKE`: このタグのランキングに残したい
- `PASS`: このタグのランキングには残さなくてよい

## 3.3 評価後に情報を開示

評価後に、以下を表示できる。

- 現在のLIKE率
- 総評価数
- 自分と他ユーザーの評価傾向
- 該当タグ
- 投稿者情報
- 現在順位またはランキング参加状況

## 3.4 低品質コンテンツの露出抑制

PASSが一定数・一定割合を超えた写真は、通常の評価キューから自動的に除外する。

ただし、投稿自体は原則として即時削除せず、公開範囲または状態を変更する。

## 3.5 新規投稿にも評価機会を与える

既存上位画像だけが配信され続けないよう、新規投稿用の探索枠を確保する。

## 3.6 ランキングの不確実性を表現する

評価数が少ない100% LIKEの写真を、十分な評価数がある高LIKE率写真より無条件に上位表示しない。

---

# 4. 対象ユーザー

## 4.1 閲覧・評価ユーザー

- 素敵な写真を短時間で見たい
- テーマ別の人気写真を発見したい
- コメントせず直感的に参加したい
- 自分の好みを可視化したい

## 4.2 投稿ユーザー

- 自分の写真を客観的に評価してほしい
- テーマ別ランキングに参加したい
- フォロワー数に依存せず写真を見てもらいたい

## 4.3 管理者

- 不適切投稿を管理したい
- AIタグや評価品質を監視したい
- 不正評価やスパムを抑制したい
- ランキング状態を確認・再計算したい

---

# 5. MVPスコープ

## 5.1 MVPに含める

- Googleアカウントによるサインアップ・ログイン
- 初回プロフィール設定
- 写真投稿
- 画像AIによるタグ候補生成
- 1画像最大5タグ
- LIKE / PASS評価
- タグ別ランキング
- 評価済み画像のみランキング上で表示
- 未評価画像のランキングマスキング
- 低評価画像の配信停止
- 投稿一覧・投稿詳細
- 自分の評価履歴
- 通報
- 管理画面の最低限機能
- 画像アップロード時の基本的な安全性チェック
- レスポンシブ対応

## 5.2 MVPに含めない

- コメント
- DM
- フォロー
- 有料課金
- 広告
- 動画投稿
- ネイティブアプリ
- 高度なコレクション機能
- 複雑なレコメンド
- 多言語対応
- 投稿者への金銭的報酬
- NFTやブロックチェーン

---

# 6. 認証・アカウント仕様

## 6.1 認証方式

MVPではGoogleアカウント認証のみを提供する。

技術候補:

- Auth.js
- Google OpenID Connect / OAuth 2.0
- PostgreSQL Database Session

推奨構成:

- Next.js
- Auth.js
- Google Provider
- Prisma Adapter
- PostgreSQL

## 6.2 サインアップフロー

1. ランディングページを表示
2. 「Googleで続ける」を選択
3. Google認証画面へ遷移
4. 認証成功後、Googleの識別子・メールアドレス・表示名・プロフィール画像を取得
5. 初回ユーザーの場合、利用規約・プライバシーポリシーへの同意画面を表示
6. LIKEPASS内のユーザー名を設定
7. 年齢確認および公開プロフィール設定
8. オンボーディングへ遷移
9. 興味のあるタグを選択
10. 評価画面へ遷移

## 6.3 取得するGoogleアカウント情報

必要最小限とする。

- Google Provider Account ID
- Email
- Email verification status
- Display name
- Profile image URL

Google Drive、Google Photos、連絡先などへの追加権限は要求しない。

基本スコープ:

- `openid`
- `email`
- `profile`

## 6.4 LIKEPASSユーザーID

GoogleのユーザーIDをアプリ内部の主キーとして直接使わない。

内部ではUUIDまたはCUIDを利用する。

```text
Google Account
  └ providerAccountId
       └ Account
            └ userId
                 └ User
```

## 6.5 1アカウント1評価

同じユーザーは、同じ写真に対して1回だけ有効な評価を持つ。

DB制約:

```sql
UNIQUE(user_id, content_id)
```

評価変更を許可する場合は、新規行を増やさず既存評価を更新する。

MVPでは、評価後5秒間のみUndoを許可する。以後の変更は評価履歴画面から行えるが、不正防止のため変更回数を記録する。

## 6.6 アカウント状態

- `ACTIVE`
- `SUSPENDED`
- `DELETED`
- `PENDING_ONBOARDING`

## 6.7 退会

退会時は以下を実施する。

- ログイン無効化
- 個人情報の削除または匿名化
- Googleアカウント連携の解除
- 投稿の扱いをユーザーに選択させる
  - 投稿を削除
  - 匿名投稿として残す
- 評価データは統計整合性のため匿名化して保持可能とする
- 法令・規約・不正対策上必要な最低限のログは保存期間を定義する

## 6.8 OAuth設定

ローカル環境と本番環境でOAuth Clientを分ける。

開発用Callback例:

```text
http://localhost:3000/api/auth/callback/google
```

本番Callback例:

```text
https://likepass.example.com/api/auth/callback/google
```

環境変数例:

```env
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_TRUST_HOST=true
DATABASE_URL=
```

秘密情報をGitHubへコミットしない。

---

# 7. オンボーディング

## 7.1 目的

- サービスの評価ルールを理解させる
- 初回から好みの画像を表示する
- タグランキングの仕組みを理解させる

## 7.2 手順

1. LIKEとPASSの説明
2. PASSは投稿者への攻撃ではなく、ランキング品質への投票であることを説明
3. 興味のあるタグを3〜10個選択
4. サンプル画像を5〜10枚評価
5. 最初のランキングを一部開放

## 7.3 表示コピー案

- LIKE: 「このランキングに残したい」
- PASS: 「今回は見送る」
- ランキングマスク: 「評価すると、この順位の写真が見られます」
- 進捗: 「あと3枚でTOP 10をすべて開放」

---

# 8. 投稿仕様

## 8.1 投稿できる形式

MVP:

- JPEG
- PNG
- WebP
- HEICはブラウザ側またはサーバー側でJPEG/WebPへ変換

## 8.2 制限

- 1投稿1画像
- 最大ファイルサイズ: 15MB
- 長辺最大: 4096px
- 最小解像度: 600 × 600px
- アスペクト比: 1:2〜2:1を推奨範囲とする
- 同一または近似画像の重複投稿を抑制
- EXIF位置情報は削除
- 表示用画像は複数サイズを生成

## 8.3 画像保存

Cloudflare R2へ保存する。

推奨フロー:

1. クライアントがアップロードURL発行APIを呼ぶ
2. APIが短時間有効なPresigned PUT URLを返す
3. ブラウザからR2へ直接アップロード
4. アップロード完了APIを呼ぶ
5. サーバーがファイル形式・サイズ・存在を確認
6. 非同期ジョブで画像解析・変換・モデレーション
7. 問題がなければ評価対象へ移行

R2秘密鍵をブラウザへ渡さない。

## 8.4 オブジェクトキー

```text
originals/{userId}/{contentId}/{uuid}.{ext}
processed/{contentId}/large.webp
processed/{contentId}/medium.webp
processed/{contentId}/thumbnail.webp
```

## 8.5 投稿状態

- `UPLOADING`
- `PROCESSING`
- `REVIEW_REQUIRED`
- `EXPLORING`
- `ACTIVE`
- `DORMANT`
- `REJECTED`
- `DELETED`

## 8.6 AI事前チェック

投稿直後に以下を確認する。

- NSFW・性的コンテンツ
- 暴力・グロテスク
- 児童安全
- 個人情報
- 文字中心の画像
- スクリーンショット
- 極端な低解像度
- ぼけ
- 真っ黒・真っ白
- 重複・近似画像
- 著作権侵害が疑われる透かし
- QRコード、広告、誘導画像
- AI生成画像である可能性

AI生成画像を禁止するかは運営方針として別途決定する。MVPでは、禁止ではなく表示ラベル候補として扱う。

---

# 9. AIタグ仕様

## 9.1 基本仕様

画像AIが写真を分析し、最大5個のハッシュタグを付与する。

例:

```text
#tokyo
#night
#street
#neon
#city
```

## 9.2 タグ分類

タグは以下の階層で管理する。

1. 主題
   - dog
   - cat
   - ramen
   - car
2. シーン
   - street
   - beach
   - cafe
   - mountain
3. スタイル
   - minimal
   - monochrome
   - cinematic
4. 属性
   - red
   - vintage
   - night
5. 地域
   - tokyo
   - kyoto
   - japan

## 9.3 タグ選定ルール

- 最大5個
- 最低1個
- 画像内で視覚的に確認できる内容に限定
- 抽象的すぎるタグは避ける
- 同義語を正規化
- 単数形・小文字・英数字のcanonical tagを内部保持
- 表示名は将来の多言語対応に備えて別フィールドで保持
- センシティブ属性の推測を行わない
- 人種、宗教、性的指向、病気などを画像から推測してタグ化しない

## 9.4 AI出力形式

```json
{
  "tags": [
    {
      "name": "tokyo",
      "confidence": 0.96,
      "category": "LOCATION"
    },
    {
      "name": "night",
      "confidence": 0.91,
      "category": "ATTRIBUTE"
    }
  ],
  "quality": {
    "blur": 0.05,
    "aesthetic": 0.81,
    "textDominance": 0.02
  },
  "safety": {
    "status": "SAFE",
    "reasons": []
  }
}
```

## 9.5 投稿者によるタグ編集

MVPでは以下の方式を推奨する。

- AI候補5個を表示
- 投稿者は候補の削除が可能
- 投稿者は正規タグ辞書から候補を追加可能
- 自由入力タグの即時新規作成は不可
- 最大5個
- 運営が不適切と判断したタグは変更可能

## 9.6 タグ品質

タグごとの評価結果に大きな差がある場合、タグ不適合の可能性がある。

例:

- `#dog`ではLIKE率85%
- `#portrait`ではLIKE率20%

この場合、`#portrait`との関連性を再判定し、該当タグだけから除外できるようにする。

したがって、投稿全体の状態とは別に、`ContentTag`単位の状態を持つ。

---

# 10. 評価仕様

## 10.1 評価画面

中央に写真を大きく表示し、主要操作は以下のみとする。

- 左スワイプ: PASS
- 右スワイプ: LIKE
- PASSボタン
- LIKEボタン
- 通報
- 一時停止

## 10.2 評価前に非表示にする情報

- 投稿者名
- 投稿者フォロワー数
- LIKE数
- PASS数
- LIKE率
- 現在順位
- コメント
- 他ユーザーの反応

## 10.3 評価コンテキスト

評価は原則としてタグ文脈で行う。

画面上部に次を表示する。

```text
#street の写真を評価中
```

同じ写真が複数タグに所属していても、ユーザーの写真に対する評価は1件を基本とする。ただし将来的には、タグ別評価を導入できる設計余地を残す。

MVPでは評価の単純性を優先し、`user_id + content_id`で一意とする。

## 10.4 評価後表示

評価直後に短時間表示する。

- 自分の評価
- 全体LIKE率
- 総評価数
- 主なタグ
- ランキング参加状況

ただし、連続評価を妨げないよう1秒以内で自動的に次へ進む。

## 10.5 スキップ

LIKE/PASSとは別に無評価スキップを設ける場合、画面上の主要ボタンには置かない。

例:

- 通信不良
- 画像が表示できない
- 判断不能
- 不適切タグ

これらは評価数に含めない。

---

# 11. 配信アルゴリズム

## 11.1 目的

- 新規投稿に必要な評価を集める
- 良質な写真を多く見せる
- 低品質写真への遭遇を抑える
- 評価の偏りを抑える
- 同一投稿者や同一タグの連続を避ける

## 11.2 評価キュー構成案

初期MVP:

- 50%: 高品質Activeコンテンツ
- 30%: 新規探索コンテンツ
- 15%: 評価不足コンテンツ
- 5%: アルゴリズム検証枠

初期探索段階で品質が不明なため、ユーザー体験悪化を防ぐよう、1セッション内で探索コンテンツが連続しないようにする。

## 11.3 候補除外

以下はキューから除外する。

- 自分の投稿
- すでに評価済み
- `DORMANT`
- `REJECTED`
- `DELETED`
- ブロック対象ユーザーの投稿
- 通報済み
- 対象タグに無効化されている投稿
- 配信上限到達
- モデレーション保留中

## 11.4 多様性制約

- 同一投稿者を連続表示しない
- 同一の近似画像を連続表示しない
- 同一被写体・構図の連続を抑制
- 同一タグだけに偏らない
- 新規ユーザーには選択した興味タグを優先する

---

# 12. コンテンツライフサイクル

## 12.1 ステージ

```text
投稿
 ↓
AI審査・画像処理
 ↓
探索プール
 ↓
品質判定
 ├─ Active Pool
 ├─ Dormant Pool
 └─ Rejected
 ↓
ランキング参加
 ↓
Top Pool / Hall of Fame
```

## 12.2 EXPLORING

投稿直後に一定数の評価を収集する。

初期値案:

- 最低評価数: 20
- 目標評価数: 50
- 初期配信上限: 100インプレッション

## 12.3 ACTIVE

以下を満たす場合に通常配信する。

- AI安全性チェック合格
- 最低評価数を満たす、または探索中に品質が十分高い
- Wilson lower boundが最低基準以上
- 通報率が許容範囲内
- 投稿者が有効アカウント

## 12.4 DORMANT

以下の条件で通常評価キューから外す。

初期ルール案:

### 早期停止

```text
評価数 >= 20
かつ
LIKE率 <= 15%
```

### 標準停止

```text
評価数 >= 50
かつ
LIKE率 <= 25%
```

### 信頼区間停止

```text
評価数 >= 30
かつ
Wilson upper bound < 35%
```

複数条件を組み合わせ、サンプル数が少ない段階で過剰に停止しないようにする。

## 12.5 DORMANTの扱い

- 評価キューには出さない
- ランキングには出さない
- 投稿者のプロフィールからは表示可能
- 直接URLで表示可能
- 投稿者へ過度に否定的な通知をしない
- 「現在、ランキング対象外」と表示する
- タグ変更後の再審査を1回まで許可可能
- 運営による再開が可能

## 12.6 タグ単位の停止

投稿全体の評価が悪いのではなく、特定タグとの適合性が悪い場合がある。

そのため、以下を別々に管理する。

- `Content.status`
- `ContentTag.status`

`ContentTag.status`:

- `PENDING`
- `ACTIVE`
- `DORMANT`
- `REMOVED`

---

# 13. ランキング仕様

## 13.1 ランキング単位

タグごとにランキングを形成する。

例:

- `#dog`
- `#architecture`
- `#street`
- `#ramen`
- `#sunset`

1投稿は最大5ランキングへ参加する。

## 13.2 基本指標

```text
LIKE Rate = like_count / (like_count + pass_count)
```

LIKE率だけでは評価数が少ない投稿が過大評価されるため、ランキングにはWilson Score Lower Boundを用いる。

## 13.3 Wilson Lower Bound

95%信頼区間を用いる場合:

```text
n = like_count + pass_count
p = like_count / n
z = 1.96

wilson_lower =
(
  p
  + z² / (2n)
  - z * sqrt((p(1-p) + z²/(4n)) / n)
)
/
(1 + z²/n)
```

評価数が0の場合は0とする。

## 13.4 MVPランキングスコア

推奨初期式:

```text
confidence_score = wilson_lower_bound(like_count, pass_count)

volume_factor =
  min(1.0, log10(total_votes + 1) / log10(target_votes + 1))

ranking_score =
  confidence_score
  * (0.70 + 0.30 * volume_factor)
  * freshness_factor
  * moderation_factor
```

初期値:

```text
target_votes = 100
moderation_factor = 1.0
```

All Timeランキングでは、`freshness_factor = 1.0`とする。

Trendingでは時間減衰を適用する。

```text
freshness_factor = exp(-age_hours / half_life_hours)
```

例:

- Daily: half-life 24時間
- Weekly: half-life 7日
- Monthly: half-life 30日

## 13.5 ランキング参加条件

初期案:

- `Content.status = ACTIVE`
- `ContentTag.status = ACTIVE`
- `total_votes >= 20`
- `like_count >= 5`
- モデレーション警告なし
- 直近の不正判定なし

## 13.6 最小LIKE数

LIKE率だけでなく、最低LIKE数を設ける。

```text
total_votes >= 20
AND like_count >= 5
```

ランキング上位用の追加条件例:

```text
TOP 100: total_votes >= 30
TOP 20: total_votes >= 50
TOP 10: total_votes >= 100
```

MVPではデータ量不足が予想されるため、固定閾値ではなくタグの流通量に応じて段階的に調整できるよう設定テーブル化する。

## 13.7 同点処理

優先順:

1. ranking_score
2. Wilson lower bound
3. 総評価数
4. LIKE数
5. 投稿日時が新しい
6. content_id

## 13.8 ランキング再計算

- 評価書き込み時に集計値を差分更新
- ランキングは非同期ジョブで再計算
- 高流量タグ: 1〜5分ごと
- 低流量タグ: 15〜60分ごと
- 必要に応じて管理画面から再計算
- RedisまたはPostgreSQL materialized viewを将来的に利用可能

MVPではPostgreSQLの集計テーブルとバックグラウンドワーカーで開始する。

---

# 14. ランキング開放UX

## 14.1 基本ルール

ユーザーがLIKEまたはPASSを判断していない写真は、ランキング上で非表示またはマスクする。

ランキングの順位自体は表示する。

例:

```text
1位  [評価済み画像]
2位  [未評価のため非表示]
3位  [評価済み画像]
4位  [未評価のため非表示]
5位  [評価済み画像]
```

ランキングの「歯抜け」を埋めることが評価継続の動機になる。

## 14.2 マスク表示

未評価の場合:

- 画像をぼかしても写真の内容が推測できるため、原則として単色プレースホルダーを使う
- 順位は表示
- 「評価すると開放」と表示
- 対象写真へ直接評価導線を提供

## 14.3 開放条件

MVP:

- その写真をLIKEまたはPASSすると開放
- 評価後は即時表示
- 評価を後から変更しても開放状態は維持

## 14.4 一括進捗

タグランキングごとに以下を表示する。

```text
TOP 10 開放: 7 / 10
TOP 50 開放: 21 / 50
```

## 14.5 評価導線

マスクされた順位をタップすると、その写真を評価する専用キューを開く。

ただし、順位が評価前に推測できることでバイアスが生じるため、評価画面では順位を表示しない。

---

# 15. 推奨画面

## 15.1 公開画面

- `/` ランディングページ
- `/signin` Googleログイン
- `/terms`
- `/privacy`
- `/guidelines`

## 15.2 ログイン後

- `/onboarding`
- `/evaluate`
- `/ranking`
- `/ranking/[tagSlug]`
- `/discover`
- `/upload`
- `/content/[contentId]`
- `/me`
- `/me/posts`
- `/me/votes`
- `/me/settings`
- `/notifications`

## 15.3 管理画面

- `/admin`
- `/admin/contents`
- `/admin/reports`
- `/admin/users`
- `/admin/tags`
- `/admin/rankings`
- `/admin/jobs`
- `/admin/feature-flags`

---

# 16. データモデル

以下は概念モデルであり、CursorはPrisma Schemaへ変換する。

## 16.1 User

```text
id
name
username
email
emailVerified
image
status
role
termsAcceptedAt
privacyAcceptedAt
onboardingCompletedAt
createdAt
updatedAt
deletedAt
```

## 16.2 Account

Auth.js標準モデルに準拠。

```text
id
userId
type
provider
providerAccountId
refresh_token
access_token
expires_at
token_type
scope
id_token
session_state
```

Google APIを追加利用しない場合、不要なアクセストークンを長期保持しない設計を優先する。

## 16.3 Session

```text
id
sessionToken
userId
expires
```

## 16.4 Content

```text
id
userId
status
originalObjectKey
largeObjectKey
mediumObjectKey
thumbnailObjectKey
width
height
aspectRatio
mimeType
fileSize
imageHash
perceptualHash
aiQualityScore
aiSafetyStatus
likeCount
passCount
voteCount
likeRate
wilsonLower
impressionCount
reportCount
publishedAt
createdAt
updatedAt
deletedAt
```

## 16.5 Tag

```text
id
slug
displayName
category
status
parentTagId
usageCount
createdAt
updatedAt
```

## 16.6 ContentTag

```text
id
contentId
tagId
source
confidence
status
likeCount
passCount
voteCount
rankingScore
currentRank
previousRank
createdAt
updatedAt
```

Unique:

```text
UNIQUE(contentId, tagId)
```

## 16.7 Vote

```text
id
userId
contentId
value
sourceTagId
sessionId
positionInSession
responseTimeMs
changedCount
createdAt
updatedAt
```

`value`:

- `LIKE`
- `PASS`

Unique:

```text
UNIQUE(userId, contentId)
```

## 16.8 Impression

```text
id
userId
contentId
tagId
sessionId
source
shownAt
viewDurationMs
result
```

`result`:

- `LIKE`
- `PASS`
- `SKIP`
- `CLOSED`
- `ERROR`

大規模化したらイベント基盤へ移行する。MVPではPostgreSQLへ保存し、保持期間や集約を設定する。

## 16.9 RankingSnapshot

```text
id
tagId
period
contentId
rank
score
voteCount
likeRate
calculatedAt
```

## 16.10 Report

```text
id
reporterUserId
contentId
reason
description
status
reviewedBy
reviewedAt
createdAt
```

## 16.11 UserTagPreference

```text
id
userId
tagId
weight
source
createdAt
updatedAt
```

## 16.12 ModerationAction

```text
id
targetType
targetId
action
reason
actorUserId
metadata
createdAt
```

## 16.13 AuditLog

管理操作を記録する。

```text
id
actorUserId
action
entityType
entityId
before
after
ipHash
createdAt
```

---

# 17. API設計

Next.js Route Handlersまたは専用APIレイヤーで実装する。

## 17.1 Authentication

Auth.js標準ルート:

```text
GET/POST /api/auth/*
```

## 17.2 Upload

```text
POST /api/uploads/presign
POST /api/uploads/complete
GET  /api/uploads/:contentId/status
DELETE /api/contents/:contentId
```

## 17.3 Evaluation

```text
GET  /api/evaluation/next
POST /api/votes
PATCH /api/votes/:contentId
GET  /api/me/votes
```

`POST /api/votes`:

```json
{
  "contentId": "content_id",
  "value": "LIKE",
  "sourceTagId": "tag_id",
  "sessionId": "session_id",
  "responseTimeMs": 1240
}
```

レスポンス:

```json
{
  "vote": {
    "contentId": "content_id",
    "value": "LIKE"
  },
  "result": {
    "likeCount": 62,
    "passCount": 18,
    "likeRate": 0.775,
    "rankingStatus": "ACTIVE"
  },
  "next": {
    "prefetch": true
  }
}
```

## 17.4 Ranking

```text
GET /api/rankings
GET /api/rankings/:tagSlug
GET /api/rankings/:tagSlug/progress
POST /api/rankings/:tagSlug/recalculate   // admin only
```

ランキングレスポンス例:

```json
{
  "tag": {
    "slug": "street",
    "displayName": "Street"
  },
  "period": "ALL_TIME",
  "items": [
    {
      "rank": 1,
      "isUnlocked": true,
      "content": {
        "id": "abc",
        "imageUrl": "https://..."
      }
    },
    {
      "rank": 2,
      "isUnlocked": false,
      "content": null
    }
  ],
  "progress": {
    "unlocked": 7,
    "total": 10
  }
}
```

未開放項目では、画像URL、contentId、投稿者情報などをクライアントへ返さない。CSSで隠すだけにしない。

## 17.5 Tags

```text
GET /api/tags
GET /api/tags/search
GET /api/tags/:slug
```

## 17.6 Reports

```text
POST /api/reports
GET  /api/admin/reports
PATCH /api/admin/reports/:id
```

---

# 18. 技術アーキテクチャ

## 18.1 推奨スタック

### Frontend / Backend

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Auth.js
- Zod
- React Hook Form

### Database

- PostgreSQL on Render
- Prisma ORM

### Image storage

- Cloudflare R2
- Cloudflare CDN or custom domain

### Background jobs

MVP候補:

- Render Background Worker
- PostgreSQL-backed job queue

候補ライブラリ:

- pg-boss
- Graphile Worker

Redis依存を必須にせず開始する。

### AI

画像AIプロバイダーを抽象化する。

```text
ImageAnalysisProvider
  ├ analyzeTags()
  ├ analyzeQuality()
  ├ moderate()
  └ generateEmbedding()
```

特定ベンダーへ密結合しない。

### Observability

- Sentry
- Render Logs
- Structured JSON logging
- Uptime monitoring
- PostHogまたはGA4

## 18.2 構成図

```text
Browser / PWA
  │
  ├── Google Sign-in
  │
  ▼
Next.js Web Service on Render
  │
  ├── Auth.js
  ├── API / Server Actions
  ├── Ranking Service
  ├── Presigned URL issuance
  │
  ├──────── PostgreSQL on Render
  │
  ├──────── Cloudflare R2
  │
  └──────── Background Worker on Render
                 │
                 ├── Image conversion
                 ├── AI tagging
                 ├── Moderation
                 └── Ranking recalculation
```

## 18.3 デプロイ方針

- GitHub main branchへのマージで本番デプロイ
- Pull Requestごとにテスト
- preview環境を利用可能なら作成
- DB migrationは明示的なリリース工程にする
- destructive migrationは自動実行しない

---

# 19. GitHubリポジトリ構成

```text
likepass/
├─ .cursor/
│  └─ rules/
│     ├─ project.mdc
│     ├─ architecture.mdc
│     ├─ security.mdc
│     └─ testing.mdc
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     ├─ deploy.yml
│     └─ security.yml
├─ docs/
│  ├─ PRODUCT_SPEC.md
│  ├─ ARCHITECTURE.md
│  ├─ DATABASE.md
│  ├─ RANKING_ALGORITHM.md
│  ├─ MODERATION.md
│  ├─ API.md
│  └─ ADR/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ public/
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ features/
│  │  ├─ auth/
│  │  ├─ upload/
│  │  ├─ evaluation/
│  │  ├─ ranking/
│  │  ├─ tags/
│  │  ├─ profile/
│  │  └─ moderation/
│  ├─ lib/
│  │  ├─ auth/
│  │  ├─ db/
│  │  ├─ r2/
│  │  ├─ ai/
│  │  ├─ jobs/
│  │  └─ observability/
│  ├─ server/
│  │  ├─ services/
│  │  ├─ repositories/
│  │  └─ policies/
│  └─ types/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ scripts/
├─ Dockerfile
├─ render.yaml
├─ package.json
├─ README.md
└─ .env.example
```

---

# 20. Cursor向け実装ルール

## 20.1 基本方針

Cursorは以下を守る。

- TypeScript strict modeを有効化
- `any`の使用を原則禁止
- 入力はZodで検証
- 認可をUIではなくサーバー側で実施
- DB制約をアプリケーションチェックだけに依存させない
- ランキング計算を純粋関数として分離
- 外部サービスはadapter interfaceで抽象化
- 重要ロジックにはユニットテストを付ける
- APIエラー形式を統一
- 画像URLや未開放情報を権限なしで返さない
- 秘密情報をログへ出力しない

## 20.2 実装単位

Cursorは一度に巨大な変更を行わず、IssueまたはPull Request単位で実装する。

1. 認証
2. DB基盤
3. R2アップロード
4. AI解析
5. 評価機能
6. 集計
7. ランキング
8. ランキング開放
9. 低品質配信停止
10. 管理機能
11. 監視
12. E2Eテスト

## 20.3 変更時の出力

各タスクで以下を提示する。

1. 実装内容
2. 変更ファイル
3. DB変更
4. 環境変数
5. テスト内容
6. 手動確認手順
7. 既知の制限
8. ロールバック方法

---

# 21. セキュリティ

## 21.1 認証

- Auth.jsを利用
- セッションCookieはSecure / HttpOnly / SameSiteを適切に設定
- OAuth state・nonce・PKCEをライブラリにより適切に処理
- Callback URLを許可済みURLに限定
- 本番とローカルのOAuth Clientを分離
- 管理画面はroleベースで制御

## 21.2 アップロード

- Presigned URLの有効期限を短くする
- 許可Content-Typeを限定
- ファイルサイズを制限
- アップロード後に実ファイルを再検証
- オブジェクトキーをユーザー入力から直接生成しない
- 元画像を公開バケットに置かない
- EXIF削除
- SVGを受け付けない

## 21.3 API

- Rate Limit
- CSRF対策
- IDOR対策
- 入力検証
- SQL InjectionはORMだけでなくraw query時に注意
- 管理APIの監査ログ
- エラーで内部情報を返さない

## 21.4 不正評価

検知候補:

- 極端に短い評価時間
- 同一IP・端末からの大量アカウント
- 特定投稿者だけへの偏った評価
- 連続したLIKEまたはPASS
- セッション内の機械的間隔
- 相互評価グループ
- 新規アカウントの大量評価

MVPでは評価を即時削除せず、`trust_weight`を将来的に導入できるデータ構造にする。

---

# 22. モデレーション

## 22.1 通報理由

- 性的コンテンツ
- 暴力・グロテスク
- 差別・ヘイト
- 嫌がらせ
- 個人情報
- 著作権侵害
- スパム・広告
- なりすまし
- 未成年者に関する懸念
- その他

## 22.2 自動制御

例:

```text
report_count >= 3
→ REVIEW_REQUIRED

重大カテゴリのAI検知
→ 公開前保留

信頼ユーザーからの重大通報
→ 一時的に配信停止
```

## 22.3 管理操作

- 公開継続
- タグ修正
- 評価キュー停止
- 投稿非公開
- 投稿削除
- 警告
- アカウント停止
- 再審査

---

# 23. KPI・分析イベント

## 23.1 North Star候補

**Quality Discovery Sessions**

定義案:

```text
1セッション内で一定数以上評価し、
かつランキングまたは詳細画面でLIKE済み画像を再閲覧したセッション数
```

## 23.2 主要KPI

### Acquisition

- Googleサインアップ完了率
- ランディング→認証開始率
- 認証開始→完了率

### Activation

- オンボーディング完了率
- 初回10評価完了率
- 初回ランキング開放率
- 初回投稿率

### Engagement

- 1日あたり評価数
- 評価セッション数
- 1セッションあたり評価数
- ランキング閲覧率
- ランキング開放進捗
- LIKE画像再閲覧率

### Retention

- D1 / D7 / D30
- 評価ユーザー継続率
- 投稿ユーザー継続率
- タグ別リテンション

### Quality

- 表示画像の平均LIKE率
- 評価キュー内DORMANT移行率
- PASS連続数
- 通報率
- 低品質画像遭遇率
- 評価前離脱率
- タグ適合率

## 23.3 イベント

```text
sign_in_started
sign_in_completed
onboarding_started
onboarding_completed
tag_followed
upload_started
upload_completed
content_published
evaluation_impression
vote_like
vote_pass
vote_changed
ranking_viewed
ranking_item_unlocked
ranking_progress_completed
content_reported
session_started
session_completed
```

イベントには必要最小限の識別情報だけを含める。

---

# 24. テスト戦略

## 24.1 Unit Test

- Wilson Score
- ランキングスコア
- DORMANT判定
- タグ最大5件
- 評価の一意性
- 評価変更
- ランキング開放判定
- 配信候補除外
- OAuth callback後のユーザー作成

## 24.2 Integration Test

- Google認証後のUser / Account作成
- Presigned URL発行
- 投稿完了
- AI解析結果保存
- LIKE/PASS集計
- 同時評価時の集計整合性
- ランキング更新
- DORMANT移行
- 未開放画像情報の非返却

## 24.3 E2E Test

Playwrightを推奨。

- テスト認証ユーザーでログイン
- オンボーディング
- 画像投稿
- AI処理完了のモック
- LIKE/PASS
- ランキング開放
- 未評価順位のマスク
- 評価後の開放
- 低品質投稿の配信停止
- 通報
- 退会

Google本番OAuthをE2Eで直接操作せず、テスト環境では認証adapterまたはテストセッションを使用する。

---

# 25. CI/CD

## 25.1 Pull Request

実行項目:

```text
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## 25.2 Main merge

- Renderへデプロイ
- DB migration
- Smoke test
- エラー監視
- 失敗時のロールバック

## 25.3 GitHub Secrets

例:

```text
RENDER_DEPLOY_HOOK
DATABASE_URL_TEST
AUTH_SECRET_TEST
```

本番のアプリ秘密情報はRender Environment Variablesで管理する。

---

# 26. 環境変数

`.env.example`:

```env
NODE_ENV=development
APP_URL=http://localhost:3000

DATABASE_URL=

AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_TRUST_HOST=true

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=

IMAGE_AI_PROVIDER=
IMAGE_AI_API_KEY=

SENTRY_DSN=
NEXT_PUBLIC_ANALYTICS_KEY=

ADMIN_EMAIL_ALLOWLIST=
```

---

# 27. 実装ロードマップ

## Phase 0: Foundation

- GitHub repository
- Next.js
- TypeScript
- Prisma
- Render
- PostgreSQL
- CI
- `.cursor/rules`
- 基本デザインシステム

完了条件:

- ローカル、CI、本番でHello Worldが動く
- migrationが動く
- secretsが分離されている

## Phase 1: Google Authentication

- Google OAuth Client作成
- Auth.js
- User / Account / Session
- 初回規約同意
- username設定
- ログアウト
- 退会基盤

完了条件:

- Googleアカウントでサインアップ・ログインできる
- 1 Googleアカウントが1 Userへ紐づく
- 未ログイン状態で保護画面へアクセスできない

## Phase 2: Upload and AI

- R2 bucket
- Presigned upload
- 画像検証
- 画像変換
- AIタグ
- AI安全性チェック
- 投稿状態管理

完了条件:

- 画像を直接R2へ投稿できる
- 解析完了後に最大5タグが付く
- 不適切画像は評価キューへ入らない

## Phase 3: LIKE / PASS

- 評価画面
- 次コンテンツAPI
- Vote
- Impression
- 集計
- Undo
- 自分の評価履歴

完了条件:

- 同一ユーザーが同一画像へ重複評価できない
- LIKE/PASS集計が正しい
- 連続評価できる

## Phase 4: Quality Lifecycle

- EXPLORING
- ACTIVE
- DORMANT
- 早期停止
- タグ単位状態
- 管理再審査

完了条件:

- PASS過多投稿が自動でキューから消える
- 新規投稿には最低限の探索機会がある
- 投稿者のプロフィールには状態が表示される

## Phase 5: Ranking

- Wilson Score
- タグ別ランキング
- RankingSnapshot
- 再計算worker
- All Time / Trending
- 最小評価数

完了条件:

- 少数票100%が過大評価されない
- 同一タグで安定した順位が計算できる
- ACTIVEのみ掲載される

## Phase 6: Ranking Unlock

- 未評価写真をサーバー側で秘匿
- マスクUI
- 開放進捗
- マスク順位から評価キューへ遷移
- 評価後の即時開放

完了条件:

- 未評価画像のURLやIDがブラウザへ漏れない
- 評価すると該当順位が開放される
- TOP 10などの進捗が表示される

## Phase 7: Moderation and Analytics

- 通報
- 管理画面
- 監査ログ
- KPIイベント
- Sentry
- 不正評価の基礎検知

---

# 28. MVP受入基準

以下をすべて満たしたらMVP完成とする。

1. Googleアカウントでサインアップ・ログインできる
2. 初回プロフィール設定と規約同意ができる
3. ログインユーザーが1枚の写真を投稿できる
4. AIが最大5タグを付与する
5. 不適切画像が評価キューへ出ない
6. ユーザーがLIKEまたはPASSできる
7. 1ユーザー1画像1評価が担保される
8. タグ別ランキングが生成される
9. 評価数の少ない100% LIKEが無条件に上位にならない
10. PASS過多画像が自動的に配信停止される
11. 未評価画像はランキングで非表示になる
12. 評価後に該当ランキング画像が開放される
13. 投稿・評価・ランキングに基本的な監視とログがある
14. 通報および管理対応ができる
15. GitHubからRenderへ安全にデプロイできる

---

# 29. Cursorへ最初に与える実装指示

以下をCursor Agentへ入力する。

```text
このリポジトリでLIKEPASSのMVPを開発します。

最初に docs/PRODUCT_SPEC.md を読み、要件を理解してください。
まだ実装は開始せず、以下を作成してください。

1. 現在のリポジトリ状態の確認
2. 推奨アーキテクチャ
3. Prismaデータモデル案
4. Route構成
5. 認証構成
6. Cloudflare R2アップロード構成
7. バックグラウンドジョブ構成
8. 実装を小さなPull Request単位に分けたIssue一覧
9. 技術的リスク
10. 未確定事項と、MVPで採用する暫定判断

前提:
- Next.js + TypeScript
- Googleアカウント認証のみ
- Auth.js
- PostgreSQL
- Prisma
- Render
- Cloudflare R2
- GitHub Actions
- 1ユーザー1画像1評価
- 画像AIタグは最大5個
- タグ別ランキング
- Wilson Scoreを利用
- PASS過多コンテンツは評価キューから除外
- 未評価画像はランキングAPIでも秘匿する

出力後、Phase 0とPhase 1の実装計画を示してください。
巨大な一括変更は行わず、各フェーズをテスト可能な単位へ分割してください。
```

---

# 30. 初期プロダクト判断

MVPでは以下を採用する。

| 論点 | 決定 |
|---|---|
| 認証 | Googleアカウントのみ |
| 評価 | LIKE / PASS |
| 評価の一意性 | user + content |
| 投稿 | 1投稿1画像 |
| タグ | AI生成、最大5個 |
| ランキング | タグ単位 |
| 基本スコア | Wilson lower bound |
| 最低評価 | 20票を初期値 |
| 低品質停止 | 評価数とLIKE率の複合条件 |
| 未評価ランキング | サーバー側で画像情報を秘匿 |
| 画像保存 | Cloudflare R2 |
| Web/API | Next.js on Render |
| DB | PostgreSQL on Render |
| ORM | Prisma |
| 非同期処理 | Render Background Worker + PostgreSQL queue |
| リポジトリ | GitHub |
| CI/CD | GitHub Actions + Render |

---

# 31. 未確定事項

実装開始後、データを見ながら調整する。

- DORMANT判定の閾値
- タグ別評価を導入するか
- AI生成画像を許可するか
- 投稿者によるタグ編集範囲
- ランキングの時間減衰
- 低流量タグの最低評価数
- 評価変更の制限
- 公開プロフィールの項目
- 投稿者に詳細なPASS率を表示するか
- Hall of Fameの定義
- 写真保存期間
- 通報数による自動非公開条件

これらはコードへ直書きせず、設定値またはFeature Flagとして変更可能にする。

---

# 32. 参考公式ドキュメント

- Google OAuth 2.0 / OpenID Connect
  - https://developers.google.com/identity/protocols/oauth2
- Google OAuth for Web Server Applications
  - https://developers.google.com/identity/protocols/oauth2/web-server
- Auth.js Google Provider
  - https://authjs.dev/getting-started/providers/google
- Auth.js Environment Variables
  - https://authjs.dev/guides/environment-variables
- Cloudflare R2 Presigned URLs
  - https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Cloudflare R2 Upload Objects
  - https://developers.cloudflare.com/r2/objects/upload-objects/
- Render Documentation
  - https://render.com/docs
- Render PostgreSQL
  - https://render.com/docs/postgresql

---

# 33. 要約

LIKEPASSの中心的なループは以下である。

```text
Googleで参加
  ↓
興味タグを選択
  ↓
写真をLIKEまたはPASS
  ↓
低品質写真が配信から外れる
  ↓
タグランキングの空欄が埋まる
  ↓
素敵な写真を発見する
  ↓
自分でも投稿する
  ↓
AIがタグを付ける
  ↓
他ユーザーの評価でランキングが更新される
```

サービスの価値は、評価数そのものではなく、評価によって良質な写真だけが発見されやすくなる循環にある。

低品質コンテンツを早期に配信停止しながら、新しい投稿にも公平な探索機会を与えることが、LIKEPASSのプロダクト品質を左右する。
