import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Download,
  Image as ImageIcon,
  Link2,
  Loader2,
  Music,
  RotateCcw,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { HistoryItem, TikTokMediaResult } from '../types/tiktok';

const HISTORY_STORAGE_KEY = 'cleanreel_history_v1';

function formatCompactCount(num: number): string {
  if (!Number.isFinite(num) || num <= 0) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

interface DownloaderWorkspaceProps {
  externalPasteTrigger: number;
}

export function DownloaderWorkspace({ externalPasteTrigger }: DownloaderWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [result, setResult] = useState<TikTokMediaResult | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadedKey, setDownloadedKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (externalPasteTrigger > 0) {
      void handlePasteFromClipboard();
    }
  }, [externalPasteTrigger]);

  function persistHistory(items: HistoryItem[]) {
    setHistory(items);
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage quota issues
    }
  }

  async function fetchTikTokVideo(targetUrl: string) {
    const cleaned = targetUrl.trim();
    if (!cleaned) {
      setErrorMessage('Paste a TikTok video or photo link to get started.');
      inputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setDownloadError(null);
    setPasteNotice(null);

    try {
      const response = await fetch('/api/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleaned }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not retrieve this TikTok post.');
      }

      const mediaResult = data as TikTokMediaResult;
      setResult(mediaResult);
      setActiveSlideIndex(0);
      setAvatarFailed(false);

      const newHistoryItem: HistoryItem = {
        id: mediaResult.id,
        sourceUrl: mediaResult.sourceUrl,
        title: mediaResult.title,
        authorHandle: mediaResult.author.uniqueId,
        authorName: mediaResult.author.nickname,
        cover: mediaResult.cover,
        duration: mediaResult.duration,
        isSlideshow: Boolean(mediaResult.images && mediaResult.images.length > 0),
        savedAt: Date.now(),
      };

      const nextHistory = [
        newHistoryItem,
        ...history.filter((item) => item.id !== newHistoryItem.id),
      ].slice(0, 6);
      persistHistory(nextHistory);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to connect to the extraction server. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void fetchTikTokVideo(urlInput);
  }

  async function handlePasteFromClipboard() {
    setErrorMessage(null);
    setPasteNotice(null);
    inputRef.current?.focus();

    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      setPasteNotice('Press Ctrl+V (or Cmd+V) to paste your TikTok link.');
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrlInput(text.trim());
        setPasteNotice('Link pasted from clipboard.');
        if (/tiktok\.com/i.test(text)) {
          void fetchTikTokVideo(text.trim());
        }
      } else {
        setPasteNotice('Your clipboard is empty. Copy a TikTok link and try again.');
      }
    } catch {
      setPasteNotice('Clipboard access blocked. Press Ctrl+V (or Cmd+V) in the input box.');
    }
  }

  async function triggerProxyDownload(
    key: string,
    mediaUrl: string,
    filename: string,
    type: 'video' | 'audio' | 'image'
  ) {
    setDownloadingKey(key);
    setDownloadError(null);

    try {
      const query = new URLSearchParams({
        url: mediaUrl,
        filename,
        type,
      });

      const response = await fetch(`/api/download?${query.toString()}`);
      if (!response.ok) {
        let serverError = 'Download failed. Please fetch the video link again.';
        try {
          const errJson = await response.json();
          if (errJson?.error) serverError = errJson.error;
        } catch {
          // Non-JSON error response
        }
        throw new Error(serverError);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

      setDownloadedKey(key);
      setTimeout(() => {
        setDownloadedKey((current) => (current === key ? null : current));
      }, 2500);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : 'Unable to save file right now.'
      );
    } finally {
      setDownloadingKey(null);
    }
  }

  function handleReset() {
    setUrlInput('');
    setResult(null);
    setErrorMessage(null);
    setDownloadError(null);
    setPasteNotice(null);
    inputRef.current?.focus();
  }

  const isSlideshow = Boolean(result?.images && result.images.length > 0);
  const activeSlideUrl =
    isSlideshow && result?.images ? result.images[activeSlideIndex] : '';

  const baseFileSlug = result
    ? `cleanreel_${result.author.uniqueId}_${result.id}`
    : 'cleanreel_video';

  return (
    <section id="downloader" className="pt-12 pb-16 sm:pt-16 sm:pb-20 border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-[clamp(2.25rem,4.4vw,3.75rem)] font-bold tracking-tight leading-[1.08] text-[#111318] [text-wrap:balance]">
            Save TikTok videos without watermarks.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Paste any public TikTok link to extract watermark-free HD MP4 video, photo
            slideshows, or original MP3 audio directly to your device.
          </p>
        </div>

        <div className="mt-8 sm:mt-10 max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 focus-within:border-[#111318] rounded-xl p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 transition-colors duration-150"
          >
            <div className="flex-1 flex items-center gap-3 px-3 min-w-0">
              <Link2 className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                type="url"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="https://www.tiktok.com/@username/video/..."
                aria-label="TikTok video URL"
                className="w-full py-2.5 text-base text-[#111318] placeholder:text-slate-400 bg-transparent focus:outline-none min-w-0"
              />
              {urlInput && (
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear URL input"
                  className="p-1.5 text-slate-400 hover:text-[#111318] rounded-md transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-3.5 py-2.5 text-sm font-medium text-slate-700 bg-[#F1F3F6] hover:bg-slate-200/80 rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
                <span>Paste</span>
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 sm:flex-initial px-6 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 rounded-lg flex items-center justify-center gap-2 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Fetching...</span>
                  </>
                ) : (
                  <span>Fetch Video</span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span>Supports tiktok.com</span>
            <span aria-hidden="true">·</span>
            <span>vm.tiktok.com</span>
            <span aria-hidden="true">·</span>
            <span>vt.tiktok.com</span>
            <span aria-hidden="true">·</span>
            <span>Photo Slideshows</span>
          </div>

          {pasteNotice && !errorMessage && (
            <p className="mt-3 text-center text-xs text-slate-600" role="status">
              {pasteNotice}
            </p>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mt-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-4 py-3 flex items-start gap-3 text-sm"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {result && (
          <div className="mt-10 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
              <div className="lg:col-span-5 bg-[#111318] rounded-xl overflow-hidden flex flex-col items-center justify-center relative min-h-[360px] lg:min-h-[440px]">
                {isSlideshow && result.images ? (
                  <>
                    <img
                      src={`/api/stream?url=${encodeURIComponent(activeSlideUrl)}`}
                      alt={`Slideshow frame ${activeSlideIndex + 1} by ${result.author.nickname}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full max-h-[460px] object-contain"
                    />
                    {result.images.length > 1 && (
                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between bg-[#111318]/85 backdrop-blur-sm text-white rounded-lg px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSlideIndex((prev) =>
                              prev === 0 ? result.images!.length - 1 : prev - 1
                            )
                          }
                          aria-label="Previous slide"
                          className="p-1 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono tabular-nums">
                          {activeSlideIndex + 1} / {result.images.length}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSlideIndex((prev) =>
                              prev === result.images!.length - 1 ? 0 : prev + 1
                            )
                          }
                          aria-label="Next slide"
                          className="p-1 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <video
                    key={result.id}
                    controls
                    playsInline
                    preload="metadata"
                    poster={
                      result.cover
                        ? `/api/stream?url=${encodeURIComponent(result.cover)}`
                        : undefined
                    }
                    src={`/api/stream?url=${encodeURIComponent(
                      result.hdNoWatermarkUrl || result.noWatermarkUrl
                    )}`}
                    className="w-full h-full max-h-[480px] object-contain"
                  />
                )}
              </div>

              <div className="lg:col-span-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {result.author.avatar && !avatarFailed ? (
                        <img
                          src={`/api/stream?url=${encodeURIComponent(result.author.avatar)}`}
                          alt={result.author.nickname}
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarFailed(true)}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700 shrink-0">
                          {result.author.nickname.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-[#111318] truncate">
                          {result.author.nickname}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          @{result.author.uniqueId}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-[#111318] bg-[#F1F3F6] hover:bg-slate-200/80 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>New Link</span>
                    </button>
                  </div>

                  <h2 className="mt-5 text-lg sm:text-xl font-semibold text-[#111318] leading-snug line-clamp-3">
                    {result.title}
                  </h2>

                  <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono tabular-nums text-slate-500">
                    {!isSlideshow && result.duration > 0 && (
                      <>
                        <span>{formatDuration(result.duration)}</span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    {isSlideshow && result.images && (
                      <>
                        <span>{result.images.length} slides</span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span>{formatCompactCount(result.stats.plays)} plays</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatCompactCount(result.stats.likes)} likes</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatCompactCount(result.stats.comments)} comments</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
                  {downloadError && (
                    <div
                      role="alert"
                      className="bg-rose-50 border border-rose-200 text-rose-900 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{downloadError}</span>
                    </div>
                  )}

                  {!isSlideshow ? (
                    <>
                      {result.hdNoWatermarkUrl ? (
                        <button
                          type="button"
                          disabled={downloadingKey !== null}
                          onClick={() =>
                            triggerProxyDownload(
                              'hd',
                              result.hdNoWatermarkUrl!,
                              `${baseFileSlug}_hd.mp4`,
                              'video'
                            )
                          }
                          className="w-full px-5 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-between gap-4 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                        >
                          <span className="flex items-center gap-2.5 whitespace-nowrap">
                            {downloadingKey === 'hd' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : downloadedKey === 'hd' ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Video className="w-4 h-4" />
                            )}
                            <span>
                              {downloadingKey === 'hd'
                                ? 'Preparing HD MP4...'
                                : downloadedKey === 'hd'
                                  ? 'Saved HD MP4'
                                  : 'Download HD MP4 (No Watermark)'}
                            </span>
                          </span>
                          <span className="text-xs font-mono tabular-nums text-rose-100 whitespace-nowrap">
                            {formatBytes(result.hdSize) || 'HD MP4'}
                          </span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        disabled={downloadingKey !== null}
                        onClick={() =>
                          triggerProxyDownload(
                            'sd',
                            result.noWatermarkUrl,
                            `${baseFileSlug}.mp4`,
                            'video'
                          )
                        }
                        className={`w-full px-5 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-between gap-4 transition-colors duration-150 cursor-pointer ${
                          result.hdNoWatermarkUrl
                            ? 'bg-[#111318] hover:bg-slate-800 text-white'
                            : 'bg-rose-600 hover:bg-rose-700 text-white'
                        } disabled:opacity-60`}
                      >
                        <span className="flex items-center gap-2.5 whitespace-nowrap">
                          {downloadingKey === 'sd' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : downloadedKey === 'sd' ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span>
                            {downloadingKey === 'sd'
                              ? 'Preparing MP4...'
                              : downloadedKey === 'sd'
                                ? 'Saved MP4'
                                : result.hdNoWatermarkUrl
                                  ? 'Download Standard MP4 (No Watermark)'
                                  : 'Download MP4 (No Watermark)'}
                          </span>
                        </span>
                        <span className="text-xs font-mono tabular-nums opacity-80 whitespace-nowrap">
                          {formatBytes(result.noWatermarkSize) || 'MP4'}
                        </span>
                      </button>
                    </>
                  ) : (
                    result.images && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          disabled={downloadingKey !== null}
                          onClick={() =>
                            triggerProxyDownload(
                              `slide-${activeSlideIndex}`,
                              activeSlideUrl,
                              `${baseFileSlug}_slide_${activeSlideIndex + 1}.jpg`,
                              'image'
                            )
                          }
                          className="w-full px-5 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-between gap-4 transition-colors duration-150 cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5 whitespace-nowrap">
                            {downloadingKey === `slide-${activeSlideIndex}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ImageIcon className="w-4 h-4" />
                            )}
                            <span>
                              Download Slide {activeSlideIndex + 1} of {result.images.length} (JPG)
                            </span>
                          </span>
                          <span className="text-xs font-mono text-rose-100">No Watermark</span>
                        </button>

                        {result.images.length > 1 && (
                          <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 pt-1">
                            {result.images.map((imgUrl, idx) => (
                              <button
                                key={imgUrl}
                                type="button"
                                onClick={() => setActiveSlideIndex(idx)}
                                className={`aspect-square rounded-lg overflow-hidden border transition-all cursor-pointer ${
                                  idx === activeSlideIndex
                                    ? 'border-rose-600 ring-2 ring-rose-600/30'
                                    : 'border-slate-200 opacity-75 hover:opacity-100'
                                }`}
                              >
                                <img
                                  src={`/api/stream?url=${encodeURIComponent(imgUrl)}`}
                                  alt={`Slide ${idx + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.music?.url && (
                      <button
                        type="button"
                        disabled={downloadingKey !== null}
                        onClick={() =>
                          triggerProxyDownload(
                            'mp3',
                            result.music!.url,
                            `${baseFileSlug}_audio.mp3`,
                            'audio'
                          )
                        }
                        className="px-4 py-3 rounded-xl bg-[#F1F3F6] hover:bg-slate-200/80 disabled:opacity-60 text-[#111318] font-medium text-sm flex items-center justify-between gap-2 transition-colors duration-150 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 truncate">
                          {downloadingKey === 'mp3' ? (
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          ) : downloadedKey === 'mp3' ? (
                            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                          ) : (
                            <Music className="w-4 h-4 text-slate-700 shrink-0" />
                          )}
                          <span className="truncate">
                            {downloadingKey === 'mp3'
                              ? 'Extracting MP3...'
                              : downloadedKey === 'mp3'
                                ? 'Saved MP3 Audio'
                                : 'Download Audio (MP3)'}
                          </span>
                        </span>
                      </button>
                    )}

                    {result.cover && (
                      <button
                        type="button"
                        disabled={downloadingKey !== null}
                        onClick={() =>
                          triggerProxyDownload(
                            'cover',
                            result.cover,
                            `${baseFileSlug}_cover.jpg`,
                            'image'
                          )
                        }
                        className="px-4 py-3 rounded-xl bg-[#F1F3F6] hover:bg-slate-200/80 disabled:opacity-60 text-[#111318] font-medium text-sm flex items-center justify-between gap-2 transition-colors duration-150 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 truncate">
                          {downloadingKey === 'cover' ? (
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          ) : downloadedKey === 'cover' ? (
                            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-700 shrink-0" />
                          )}
                          <span className="truncate">
                            {downloadingKey === 'cover'
                              ? 'Saving Cover...'
                              : downloadedKey === 'cover'
                                ? 'Saved Cover JPG'
                                : 'Download Cover (JPG)'}
                          </span>
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-10 max-w-4xl mx-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-[#111318]">Recent Fetched Links</h3>
              <button
                type="button"
                onClick={() => persistHistory([])}
                className="text-xs font-medium text-slate-500 hover:text-rose-600 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear History</span>
              </button>
            </div>
            <div className="divide-y divide-slate-200/80">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setUrlInput(item.sourceUrl);
                    void fetchTikTokVideo(item.sourceUrl);
                  }}
                  className="w-full py-3 px-2 -mx-2 rounded-lg hover:bg-slate-100/70 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#111318] truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      @{item.authorHandle} ·{' '}
                      <span className="font-mono tabular-nums">
                        {item.isSlideshow ? 'Photo Slideshow' : formatDuration(item.duration)}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs font-medium text-rose-600 whitespace-nowrap shrink-0">
                    Load Again
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
