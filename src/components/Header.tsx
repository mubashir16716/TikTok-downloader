interface HeaderProps {
  onPasteAction: () => void;
}

export function Header({ onPasteAction }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#FAFAFB]/95 backdrop-blur-sm border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <a
          href="#downloader"
          className="text-xl font-bold tracking-tight text-[#111318] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-600 rounded"
        >
          CleanReel
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600"
        >
          <a
            href="#downloader"
            className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Downloader
          </a>
          <a
            href="#how-it-works"
            className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            How It Works
          </a>
          <a
            href="#formats"
            className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Formats
          </a>
          <a
            href="#faq"
            className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            FAQ
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPasteAction}
            className="px-4 py-2 text-sm font-medium text-white bg-[#111318] hover:bg-rose-600 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
          >
            Paste Link
          </button>
        </div>
      </div>
    </header>
  );
}
