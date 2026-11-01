export function Icon({ name, className = '' }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    image: 'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M15 7h.01',
    moon: 'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z',
    sun: 'M12 3V1m0 22v-2M3 12H1m22 0h-2M5 5 3 3m18 18-2-2M5 19l-2 2M21 3l-2 2M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10',
    stop: 'M8 2h8l6 6v8l-6 6H8l-6-6V8ZM12 7v6m0 4h.01',
    caution: 'm12 3 10 18H2ZM12 9v5m0 3h.01',
    none: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 11v6m0-10h.01',
    help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9 8a3 3 0 1 1 4 3v3m-1 3h.01',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    copy: 'M8 8h13v13H8zM16 8V3H3v13h5',
    close: 'm6 6 12 12M6 18 18 6',
  };
  return (
    <svg
      class={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.help} />
    </svg>
  );
}
