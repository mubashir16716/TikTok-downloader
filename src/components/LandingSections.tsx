import { ChevronDown, Film, Headphones } from 'lucide-react';
import { useState } from 'react';

const WORKFLOW_STEPS = [
  {
    number: '01.',
    title: 'Copy any public TikTok link',
    description:
      'Open TikTok on mobile or desktop, tap Share, and select Copy Link. Standard video links, short vm.tiktok.com links, and photo carousels are all supported.',
  },
  {
    number: '02.',
    title: 'Strip overlays and extract source media',
    description:
      'CleanReel resolves the upstream CDN stream without the bouncing username watermark, keeping original frame timing and crisp resolution intact.',
  },
  {
    number: '03.',
    title: 'Download MP4, MP3, or high-res slides',
    description:
      'Preview the clean video directly in the browser, then save HD MP4 video, standard MP4, original MP3 audio, or individual slideshow frames in one click.',
  },
];

const FORMAT_SPECS = [
  {
    format: 'HD MP4 Video',
    spec: 'Up to 1080p · H.264',
    watermark: 'None',
    useCase: 'Editing, archiving, and clean re-uploads',
  },
  {
    format: 'Standard MP4 Video',
    spec: '720p · Compact size',
    watermark: 'None',
    useCase: 'Fast mobile sharing and messaging apps',
  },
  {
    format: 'Original Audio',
    spec: 'MP3 · Stereo stream',
    watermark: 'N/A',
    useCase: 'Background tracks, voiceovers, and ringtones',
  },
  {
    format: 'Photo Slideshow',
    spec: 'Original JPG · Full res',
    watermark: 'None',
    useCase: 'Saving clean frames from multi-photo TikTok posts',
  },
];

const FAQS = [
  {
    question: 'Does CleanReel remove the TikTok watermark completely?',
    answer:
      'Yes. Instead of cropping or blurring the video, CleanReel fetches the clean source media stream directly from the video post so there is no bouncing TikTok logo or username stamp.',
  },
  {
    question: 'Do I need to install an app or browser extension?',
    answer:
      'No. Everything runs directly in your browser on Windows, macOS, Android, and iPhone. Just paste a public TikTok URL and save the file straight to your downloads folder.',
  },
  {
    question: 'Can I download only the MP3 sound from a TikTok video?',
    answer:
      'Yes. Once you fetch a TikTok link, a dedicated Download Audio (MP3) button appears alongside the MP4 video options whenever an audio track is present.',
  },
  {
    question: 'Why did a specific TikTok link fail to load?',
    answer:
      'Only public TikTok posts can be extracted. Private accounts, region-locked videos, or posts that were recently deleted cannot be accessed.',
  },
];

export function LandingSections() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [deskImgError, setDeskImgError] = useState(false);
  const [audioImgError, setAudioImgError] = useState(false);

  return (
    <>
      <section id="how-it-works" className="py-16 sm:py-24 border-b border-slate-200/80">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111318] [text-wrap:balance]">
              Three steps from share link to clean file.
            </h2>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              Built for creators, editors, and everyday viewers who need clean source clips
              without intrusive pop-ups or degraded re-encodes.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 min-h-[260px]">
              {!deskImgError ? (
                <img
                  src="/src/assets/images/workflow_creator_desk_1795594304625.jpg"
                  alt="Minimalist creator workstation displaying vertical short-form video timeline"
                  referrerPolicy="no-referrer"
                  onError={() => setDeskImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full min-h-[280px] bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-8 text-center">
                  <Film className="w-8 h-8 text-slate-500 mb-3" />
                  <p className="text-sm font-medium text-slate-700">
                    Clean vertical video workflow
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-6 flex flex-col justify-between divide-y divide-slate-200 border-y border-slate-200">
              {WORKFLOW_STEPS.map((step) => (
                <div key={step.number} className="py-6 first:pt-5 last:pb-5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm font-medium text-rose-600 tabular-nums shrink-0">
                      {step.number}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-[#111318]">{step.title}</h3>
                      <p className="mt-1.5 text-sm sm:text-base text-slate-600 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="formats" className="py-16 sm:py-24 border-b border-slate-200/80 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111318] [text-wrap:balance]">
                  Every format you need, at original quality.
                </h2>
                <p className="mt-3 text-base text-slate-600 leading-relaxed max-w-xl">
                  Choose HD video for post-production, compact MP4 for quick sharing, or extract
                  the clean audio track directly as an MP3 file.
                </p>
              </div>

              <div className="mt-8 overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#FAFAFB] text-xs font-medium text-slate-500">
                      <th className="py-3 px-4">Format</th>
                      <th className="py-3 px-4">Output Spec</th>
                      <th className="py-3 px-4">Watermark</th>
                      <th className="py-3 px-4 hidden sm:table-cell">Best For</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {FORMAT_SPECS.map((row) => (
                      <tr key={row.format} className="hover:bg-[#FAFAFB]/70 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-[#111318] whitespace-nowrap">
                          {row.format}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                          {row.spec}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                          {row.watermark}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 hidden sm:table-cell">
                          {row.useCase}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 min-h-[260px]">
              {!audioImgError ? (
                <img
                  src="/src/assets/images/audio_waveform_studio_1795594304772.jpg"
                  alt="Studio headphones and aluminum audio interface for clean MP3 audio extraction"
                  referrerPolicy="no-referrer"
                  onError={() => setAudioImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full min-h-[280px] bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-8 text-center">
                  <Headphones className="w-8 h-8 text-slate-500 mb-3" />
                  <p className="text-sm font-medium text-slate-700">
                    Lossless stream & MP3 extraction
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="py-16 sm:py-24">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111318] [text-wrap:balance]">
            Frequently asked questions
          </h2>

          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {FAQS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={item.question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full py-5 flex items-center justify-between gap-4 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-rose-600 rounded"
                  >
                    <span className="text-base font-semibold text-[#111318]">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-150 ${
                        isOpen ? 'rotate-180 text-[#111318]' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <p className="pb-5 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <a href="#downloader" className="text-lg font-bold tracking-tight text-[#111318]">
              CleanReel
            </a>
            <p className="mt-1 text-xs text-slate-500">
              Respect creator copyrights. Only download content you have permission to save.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
            <a href="#downloader" className="hover:text-[#111318] transition-colors whitespace-nowrap">
              Downloader
            </a>
            <a href="#how-it-works" className="hover:text-[#111318] transition-colors whitespace-nowrap">
              How It Works
            </a>
            <a href="#formats" className="hover:text-[#111318] transition-colors whitespace-nowrap">
              Formats
            </a>
            <a href="#faq" className="hover:text-[#111318] transition-colors whitespace-nowrap">
              FAQ
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
