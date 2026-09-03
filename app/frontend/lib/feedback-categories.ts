// フィードバックの種類（CONTEXT.md「フィードバック」の 4 カテゴリ）。
// ラベルと型だけを共有する。アイコン・色は画面ごとに異なるためここには置かない。
export type FeedbackCategory = 'bug_report' | 'feature_request' | 'usage_question' | 'other';

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
	bug_report: 'バグ報告',
	feature_request: '機能リクエスト',
	usage_question: '使い方の質問',
	other: 'その他'
};
