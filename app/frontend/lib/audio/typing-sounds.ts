import { settingsStore } from '@/stores/settings-store';

export class TypingSoundManager {
	private correctSound: HTMLAudioElement | null = null;
	private incorrectSound: HTMLAudioElement | null = null;
	private gameEndSound: HTMLAudioElement | null = null;
	private flickCardSound: HTMLAudioElement | null = null;
	private completeSound: HTMLAudioElement | null = null;
	private bgmTypingSound: HTMLAudioElement | null = null;
	private typingSoundEnabled: boolean = true;
	private effectsEnabled: boolean = true;
	private bgmEnabled: boolean = true;
	private voiceEnabled: boolean = false;
	private typingSoundVolume: number = 0.5;
	private effectsVolume: number = 0.5;
	private bgmVolume: number = 0.3;
	private voiceSpeed: number = 1.0;
	private currentVoice: HTMLAudioElement | null = null;
	private unsubscribe: (() => void) | null = null;

	constructor() {
		if (typeof window !== 'undefined') {
			this.initializeSounds();
			this.loadSettingsFromStore();
			this.subscribeToSettings();
		}
	}

	private initializeSounds() {
		try {
			this.correctSound = new Audio('/sounds/typing/keyStroke.mp3');
			this.incorrectSound = new Audio('/sounds/typing/incorrect.mp3');
			this.gameEndSound = new Audio('/sounds/effects/whistle.mp3');
			this.flickCardSound = new Audio('/sounds/effects/flickCard.mp3');
			this.completeSound = new Audio('/sounds/effects/correct.mp3');
			this.bgmTypingSound = new Audio('/sounds/BGM/Typing01.mp3');

			this.correctSound.volume = this.typingSoundVolume;
			this.incorrectSound.volume = this.typingSoundVolume;
			this.gameEndSound.volume = this.effectsVolume;
			this.flickCardSound.volume = this.effectsVolume;
			this.completeSound.volume = this.effectsVolume;
			this.bgmTypingSound.volume = this.bgmVolume;

			this.correctSound.preload = 'auto';
			this.incorrectSound.preload = 'auto';
			this.gameEndSound.preload = 'auto';
			this.flickCardSound.preload = 'auto';
			this.completeSound.preload = 'auto';
			this.bgmTypingSound.preload = 'auto';

			// BGMをループ再生に設定
			this.bgmTypingSound.loop = true;
		} catch (error) {
			console.error('Failed to initialize typing sounds:', error);
		}
	}

	public playCorrect() {
		if (!this.typingSoundEnabled || !this.correctSound) return;
		try {
			const sound = this.correctSound.cloneNode() as HTMLAudioElement;
			sound.volume = this.typingSoundVolume;
			sound.play().catch((error) => {
				console.error('Failed to play correct sound:', error);
			});
		} catch (error) {
			console.error('Error playing correct sound:', error);
		}
	}

	public playIncorrect() {
		if (!this.typingSoundEnabled || !this.incorrectSound) return;
		try {
			const sound = this.incorrectSound.cloneNode() as HTMLAudioElement;
			sound.volume = this.typingSoundVolume;
			sound.play().catch((error) => {
				console.error('Failed to play incorrect sound:', error);
			});
		} catch (error) {
			console.error('Error playing incorrect sound:', error);
		}
	}

	public playGameEnd() {
		if (!this.effectsEnabled || !this.gameEndSound) return;

		try {
			const sound = this.gameEndSound.cloneNode() as HTMLAudioElement;
			sound.volume = this.effectsVolume;
			sound.play().catch((error) => {
				console.error('Failed to play game end sound:', error);
			});
		} catch (error) {
			console.error('Error playing game end sound:', error);
		}
	}

	public playFlickCard() {
		if (!this.effectsEnabled || !this.flickCardSound) return;

		try {
			const sound = this.flickCardSound.cloneNode() as HTMLAudioElement;
			sound.volume = this.effectsVolume;
			sound.play().catch((error) => {
				console.error('Failed to play flick card sound:', error);
			});
		} catch (error) {
			console.error('Error playing flick card sound:', error);
		}
	}

	public playComplete() {
		if (!this.effectsEnabled || !this.completeSound) return;

		try {
			const sound = this.completeSound.cloneNode() as HTMLAudioElement;
			sound.volume = this.effectsVolume;
			sound.play().catch((error) => {
				console.error('Failed to play complete sound:', error);
			});
		} catch (error) {
			console.error('Error playing complete sound:', error);
		}
	}

	public playCardReading(cardId: string) {
		if (!this.voiceEnabled) return;

		this.stopCardReading();

		try {
			let playCount = 0;
			const playOnce = () => {
				const audio = new Audio(`/sounds/voice/${cardId}.mp3`);
				audio.volume = this.effectsVolume;
				audio.playbackRate = this.voiceSpeed;
				this.currentVoice = audio;

				audio.addEventListener('ended', () => {
					if (this.currentVoice !== audio) return;
					playCount++;
					// 読み上げは2回再生する
					if (playCount < 2) {
						playOnce();
					} else {
						this.currentVoice = null;
					}
				});

				audio.play().catch(() => {
					this.currentVoice = null;
				});
			};

			playOnce();
		} catch (error) {
			console.error('Error playing card reading:', error);
		}
	}

	public stopCardReading() {
		if (this.currentVoice) {
			try {
				this.currentVoice.pause();
				this.currentVoice.currentTime = 0;
				this.currentVoice.src = '';
				this.currentVoice = null;
			} catch {
				this.currentVoice = null;
			}
		}
	}

	public async startBGM() {
		if (!this.bgmEnabled || !this.bgmTypingSound) return;

		try {
			// 既に再生中の場合は一度停止
			if (!this.bgmTypingSound.paused) {
				this.bgmTypingSound.pause();
			}

			this.bgmTypingSound.currentTime = 0;

			// 少し遅延を入れてから再生（ブラウザの自動再生ポリシー対策）
			await new Promise((resolve) => setTimeout(resolve, 100));

			await this.bgmTypingSound.play();
		} catch (error) {
			console.error('Failed to play BGM:', error);
			// リトライ機構
			setTimeout(() => {
				if (this.bgmTypingSound && this.bgmEnabled) {
					this.bgmTypingSound.play().catch(() => {
						console.error('BGM retry also failed');
					});
				}
			}, 500);
		}
	}

	public stopBGM() {
		if (!this.bgmTypingSound) return;

		try {
			this.bgmTypingSound.pause();
			this.bgmTypingSound.currentTime = 0;
		} catch (error) {
			console.error('Error stopping BGM:', error);
		}
	}

	public pauseBGM() {
		if (!this.bgmTypingSound) return;

		try {
			this.bgmTypingSound.pause();
		} catch (error) {
			console.error('Error pausing BGM:', error);
		}
	}

	public resumeBGM() {
		if (!this.bgmEnabled || !this.bgmTypingSound) return;

		try {
			this.bgmTypingSound.play().catch((error) => {
				console.error('Failed to resume BGM:', error);
			});
		} catch (error) {
			console.error('Error resuming BGM:', error);
		}
	}

	public setEnabled(typingSoundEnabled: boolean, effectsEnabled: boolean) {
		this.typingSoundEnabled = typingSoundEnabled;
		this.effectsEnabled = effectsEnabled;
	}

	public setVolume(typingSoundVolume: number, effectsVolume: number, bgmVolume: number) {
		this.typingSoundVolume = Math.max(0, Math.min(1, typingSoundVolume));
		this.effectsVolume = Math.max(0, Math.min(1, effectsVolume));
		this.bgmVolume = Math.max(0, Math.min(1, bgmVolume));
		if (this.correctSound) {
			this.correctSound.volume = this.typingSoundVolume;
		}
		if (this.incorrectSound) {
			this.incorrectSound.volume = this.typingSoundVolume;
		}
		if (this.gameEndSound) {
			this.gameEndSound.volume = this.effectsVolume;
		}
		if (this.flickCardSound) {
			this.flickCardSound.volume = this.effectsVolume;
		}
		if (this.completeSound) {
			this.completeSound.volume = this.effectsVolume;
		}
		if (this.bgmTypingSound) {
			this.bgmTypingSound.volume = this.bgmVolume;
		}
	}

	public isAvailable(): boolean {
		return this.correctSound !== null && this.incorrectSound !== null;
	}

	private loadSettingsFromStore() {
		const settings = settingsStore.getState();
		// 音量を0-100から0-1に変換
		this.typingSoundEnabled = settings.sound.typingSoundEnabled;
		this.typingSoundVolume = settings.sound.typingSoundVolume / 100;
		this.effectsEnabled = settings.sound.effectsEnabled;
		this.effectsVolume = settings.sound.effectsVolume / 100;
		this.bgmEnabled = settings.sound.bgmEnabled;
		this.bgmVolume = settings.sound.bgmVolume / 100;
		this.voiceEnabled = settings.sound.voiceEnabled;
		this.voiceSpeed = settings.sound.voiceSpeed;

		// 既存の音声要素に適用
		if (this.correctSound) {
			this.correctSound.volume = this.typingSoundVolume;
		}
		if (this.incorrectSound) {
			this.incorrectSound.volume = this.typingSoundVolume;
		}
		if (this.gameEndSound) {
			this.gameEndSound.volume = this.effectsVolume;
		}
		if (this.flickCardSound) {
			this.flickCardSound.volume = this.effectsVolume;
		}
		if (this.completeSound) {
			this.completeSound.volume = this.effectsVolume;
		}
		if (this.bgmTypingSound) {
			this.bgmTypingSound.volume = this.bgmVolume;
		}
	}

	private subscribeToSettings() {
		// zustand の subscribe は変更時のみ呼ばれる（Svelte と違い購読直後には呼ばれない）。
		// 初期値は直前の loadSettingsFromStore() で反映済み。
		this.unsubscribe = settingsStore.subscribe((settings) => {
			// 音量設定の変更を監視
			const newTypingSoundEnabled = settings.sound.typingSoundEnabled;
			const newTypingSoundVolume = settings.sound.typingSoundVolume / 100;
			const newEffectsEnabled = settings.sound.effectsEnabled;
			const newEffectsVolume = settings.sound.effectsVolume / 100;
			const newBGMEnabled = settings.sound.bgmEnabled;
			const newBGMVolume = settings.sound.bgmVolume / 100;

			// 有効フラグは単純に反映
			this.typingSoundEnabled = newTypingSoundEnabled;
			this.effectsEnabled = newEffectsEnabled;
			this.bgmEnabled = newBGMEnabled;
			this.voiceEnabled = settings.sound.voiceEnabled;
			this.voiceSpeed = settings.sound.voiceSpeed;

			// 再生中の読み上げ音声の速度を更新
			if (this.currentVoice) {
				this.currentVoice.playbackRate = this.voiceSpeed;
			}

			// いずれかの音量が変わったときのみ一度だけ適用
			const typingChanged = this.typingSoundVolume !== newTypingSoundVolume;
			const effectsChanged = this.effectsVolume !== newEffectsVolume;
			const bgmChanged = this.bgmVolume !== newBGMVolume;

			if (typingChanged || effectsChanged || bgmChanged) {
				this.setVolume(newTypingSoundVolume, newEffectsVolume, newBGMVolume);
			}
		});
	}

	public destroy() {
		// 読み上げ音声を停止
		this.stopCardReading();
		// BGMを停止
		this.stopBGM();

		// オーディオ要素をクリーンアップ
		if (this.bgmTypingSound) {
			this.bgmTypingSound.pause();
			this.bgmTypingSound.src = '';
			this.bgmTypingSound = null;
		}
		if (this.correctSound) {
			this.correctSound.src = '';
			this.correctSound = null;
		}
		if (this.incorrectSound) {
			this.incorrectSound.src = '';
			this.incorrectSound = null;
		}
		if (this.gameEndSound) {
			this.gameEndSound.src = '';
			this.gameEndSound = null;
		}
		if (this.flickCardSound) {
			this.flickCardSound.src = '';
			this.flickCardSound = null;
		}
		if (this.completeSound) {
			this.completeSound.src = '';
			this.completeSound = null;
		}

		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}
}
