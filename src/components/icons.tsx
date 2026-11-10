const paths = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 5v4.6l3 1.8-.8 1.3L11 13.4V8h2Z",
  gift: "M4 9h16v4H4V9Zm1 5h14v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6Zm6-5h2v12h-2V9Zm1-1C9 8 8 6.5 8.8 5.4 9.8 4 12 5.5 12 8Zm0 0c0-2.5 2.2-4 3.2-2.6C16 6.5 15 8 12 8Z",
  user: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-8 9a8 8 0 0 1 16 0H4Z",
  qr: "M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-2h3v3h-3v-3Zm5 0h3v3h-3v-3Zm-5 5h3v3h-3v-3Zm5 0h3v3h-3v-3Z",
  houses: "M2 12 8 6l6 6v8H2v-8Zm14 8v-9.2l-1.6-1.6L17 6.6l5 4.9V20h-6Z",
  chart: "M4 20V4h2v14h14v2H4Zm4-4V9h3v7H8Zm5 0V6h3v10h-3Zm5 0v-5h3v5h-3Z",
  logout: "M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3Zm5.6 4.6L14.2 9l2 2H8v2h8.2l-2 2 1.4 1.4L20 12l-4.4-4.4Z",
  check: "M9.5 17.2 4.8 12.5l1.4-1.4 3.3 3.3 8.3-8.3 1.4 1.4-9.7 9.7Z",
  warn: "M12 3 2 20h20L12 3Zm1 5v6h-2V8h2Zm0 8v2h-2v-2h2Z",
  "chevron-right": "M9.4 18 8 16.6l4.6-4.6L8 7.4 9.4 6l6 6-6 6Z",
  "arrow-left": "M11 5.6 12.4 7l-4 4H20v2H8.4l4 4-1.4 1.4L4.6 12 11 5.6Z",
  plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z",
  search: "M10 3a7 7 0 0 1 5.6 11.2l5 5-1.4 1.4-5-5A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z",
  leaf: "M20 3c0 9-4.5 15-12 15-1 0-2-.2-2.8-.5L3.4 20 2 18.6l2.6-2.5C4.2 15.2 4 14.2 4 13 4 7 9 3 20 3Zm-2 2.1C10.8 5.6 6 8.3 6 13c0 .6.1 1.2.3 1.7l6-5.9 1.4 1.4-6 5.9c.4.2 1 .3 1.6.3 5.2 0 8.3-3.8 8.7-11.3Z",
  recycle: "M12 2.5 15.5 8l-1.7 1-1.8-2.9-1.9 3.1-1.7-1L12 2.5ZM5.2 11.3l1.7 1-2 3.2H8V18H3.4l-1.1-1.9 2.9-4.8Zm13.6 0 2.9 4.8-1.1 1.9h-5.6l1.8-2h2.6l-2-3.2 1.4-1.5ZM9.5 15.5h3v2h-3v-2Z",
  trash: "M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 9Zm4 2v8h1.5v-8H10Zm2.5 0v8H14v-8h-1.5Z",
  menu: "M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z",
  "chevron-down": "M6 9.4 7.4 8l4.6 4.6L16.6 8 18 9.4l-6 6-6-6Z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d={paths[name]} />
    </svg>
  );
}
