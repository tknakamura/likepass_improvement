export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl prose dark:prose-invert">
      <h1>プライバシーポリシー</h1>
      <p>LIKEPASSはユーザーのプライバシーを尊重します。</p>
      <h2>収集する情報</h2>
      <ul>
        <li>Googleアカウントのメール、表示名、プロフィール画像</li>
        <li>投稿した写真と評価データ</li>
        <li>利用ログ（セキュリティ・品質向上のため）</li>
      </ul>
      <h2>利用目的</h2>
      <p>サービス提供、品質向上、不正防止のために利用します。</p>
      <h2>第三者提供</h2>
      <p>法令に基づく場合を除き、同意なく第三者に提供しません。</p>
    </div>
  );
}
