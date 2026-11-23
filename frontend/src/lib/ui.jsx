import { Banknote, QrCode, Landmark, CircleCheck, CircleAlert, TriangleAlert } from 'lucide-react';

// Satu set ikon: lucide, 16px, stroke 1.5
export const ico = { size: 16, strokeWidth: 1.5, 'aria-hidden': true };

// Satu kurva easing, hanya properti murah yang dianimasikan
export const motion =
    'transition-[color,background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]';
const focus =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800';

// Permukaan & teks
export const card = 'rounded-2xl border border-neutral-900/10 bg-white';
export const label = 'mb-1 block text-[13px] leading-5 font-medium text-neutral-700';
export const hint = 'mt-1 text-xs leading-4 text-neutral-500';
export const field = `h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/15 ${motion}`;

// Tombol: tinggi 40, radius 8
const btn = `inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${motion} ${focus}`;
export const btnPrimary = `${btn} bg-blue-800 text-white hover:bg-blue-900`;
export const btnSecondary = `${btn} border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100`;
export const btnGhost = `${btn} px-3 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900`;
export const iconBtn = `inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 ${motion} ${focus}`;

// Label data
export const methodLabel = { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer' };
export const methodIcon = { tunai: Banknote, qris: QrCode, transfer: Landmark };
export const shiftLabel = { pagi: 'Pagi', siang: 'Siang' };
export const shiftHours = { pagi: '08:00–14:00', siang: '14:00–21:00' };

// Tanggal & jam lokal (toISOString memakai UTC, di WIB salah hari sebelum 07:00)
export const todayISO = () => new Date().toLocaleDateString('sv-SE');
export const nowHHMM = () =>
    new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const formatDateID = (iso) =>
    iso
        ? new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
        : 'Semua tanggal';

export function ShiftTag({ shift }) {
    return (
        <span className="inline-flex items-center gap-2 text-[13px] leading-5 text-neutral-700">
            <span
                className={`h-2 w-2 rounded-full ${shift === 'pagi' ? 'bg-amber-500' : 'bg-blue-800'}`}
                aria-hidden="true"
            />
            {shiftLabel[shift] || shift}
        </span>
    );
}

const tones = {
    success: { box: 'border-emerald-700/20 bg-emerald-50 text-emerald-900', Icon: CircleCheck },
    error: { box: 'border-red-600/20 bg-red-50 text-red-900', Icon: CircleAlert },
    warning: { box: 'border-amber-600/25 bg-amber-50 text-amber-950', Icon: TriangleAlert }
};

export function Notice({ kind = 'success', children, className = '' }) {
    const { box, Icon } = tones[kind];
    return (
        <div
            role={kind === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-lg border p-3 text-sm leading-5 ${box} ${className}`}
        >
            <Icon {...ico} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

export function PageHeader({ eyebrow, title, description, actions }) {
    return (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                {eyebrow && <p className="mb-2 text-[13px] leading-5 text-neutral-500">{eyebrow}</p>}
                <h2 className="text-[28px] leading-8 font-medium text-neutral-900">{title}</h2>
                {description && (
                    <p className="mt-2 max-w-[36rem] text-sm leading-5 text-neutral-600">{description}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap items-end gap-2">{actions}</div>}
        </div>
    );
}