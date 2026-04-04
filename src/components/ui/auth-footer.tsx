export function AuthFooter() {
  return (
    <footer className="mt-12 border-t border-[#1a2540] pt-8 text-center text-sm text-[#7a88a8]">
      <p className="mb-4">ClientPulse · a product by Aurora</p>
      <div className="flex flex-wrap justify-center gap-4 mb-4">
        <a
          href="https://helloaurora.ai/impressum.html"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#e74c3c] transition-colors"
        >
          Impressum
        </a>
        <a
          href="https://helloaurora.ai/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#e74c3c] transition-colors"
        >
          Privacy
        </a>
        <a
          href="https://helloaurora.ai/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#e74c3c] transition-colors"
        >
          Terms
        </a>
        <a
          href="https://helloaurora.ai/refund.html"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#e74c3c] transition-colors"
        >
          Refund Policy
        </a>
      </div>
      <p className="text-xs text-[#5a6885]">© 2026 Aurora AI Solutions Studio UG (haftungsbeschränkt)</p>
    </footer>
  );
}
