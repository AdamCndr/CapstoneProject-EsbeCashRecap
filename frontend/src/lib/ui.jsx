import { Banknote, QrCode, Landmark, CircleCheck, CircleAlert, TriangleAlert } from 'lucide-react';

// Satu set ikon: lucide, 16px, stroke 1.5
export const ico = { size: 16, strokeWidth: 1.5, 'aria-hidden': true };

// Satu kurva easing, hanya properti murah yang dianimasikan
export const motion =
    'transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] motion-reduce:transition-none';
const focus =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--royal-500)]';

// Permukaan & teks (semua warna dari palette.css / tokens.css)
export const card = 'rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)]';
export const label = 'mb-1 block text-xs leading-4 font-medium text-[var(--text-muted-alt)]';
export const hint = 'mt-1 text-xs leading-4 text-[var(--text-muted)]';
export const field = `h-10 w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] hover:border-[color:var(--royal-400)] focus:border-[color:var(--royal-400)] focus:bg-[var(--surface-card)] focus:outline-none focus:ring-2 focus:ring-[color:var(--royal-300)] active:scale-[0.99] ${motion}`;

// Tombol: tinggi 40, radius 12
const btn = `inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${motion} ${focus}`;
export const btnPrimary = `${btn} bg-[var(--royal-700)] text-[var(--text-inverse)] hover:bg-[var(--royal-800)]`;
export const btnSecondary = `${btn} border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-main)] hover:bg-[var(--surface-muted)]`;
export const btnGhost = `${btn} px-3 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)]`;
export const iconBtn = `inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)] ${motion} ${focus}`;

// Label data
export const methodLabel = { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer' };
export const methodIcon = { tunai: Banknote, qris: QrCode, transfer: Landmark };
export const shiftLabel = { pagi: 'Pagi', siang: 'Siang' };
export const shiftHours = { pagi: '06:00–14:00', siang: '14:00–22:00' };

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
        <span className="inline-flex items-center gap-2 text-[13px] leading-5 text-[var(--text-muted-alt)] tabular-nums">
            <span
                className={`h-2 w-2 rounded-full ${shift === 'pagi' ? 'bg-[var(--shift-pagi)]' : 'bg-[var(--shift-siang)]'}`}
                aria-hidden="true"
            />
            {shiftLabel[shift] || shift}
        </span>
    );
}

const tones = {
    success: { box: 'border-[var(--cash-in)] bg-[var(--cash-in-light)] text-[var(--cash-in)]', Icon: CircleCheck },
    error: { box: 'border-[var(--cash-out)] bg-[var(--cash-out-light)] text-[var(--cash-out)]', Icon: CircleAlert },
    warning: { box: 'border-[var(--amber-500)] bg-[var(--amber-50)] text-[var(--amber-700)]', Icon: TriangleAlert }
};

export function Notice({ kind = 'success', children, className = '' }) {
    const { box, Icon } = tones[kind];
    return (
        <div
            role={kind === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-xl border p-3 text-sm leading-5 ${box} ${className}`}
        >
            <Icon {...ico} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

export function PageHeader({ eyebrow, title, description, actions }) {
    return (
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                {eyebrow && <p className="mb-2 text-xs leading-4 text-[var(--text-muted)]">{eyebrow}</p>}
                <h2 className="text-2xl leading-tight font-semibold text-[var(--text-main)] sm:text-[28px]">{title}</h2>
                {description && (
                    <p className="mt-2 max-w-[36rem] text-[13px] leading-5 text-[var(--text-muted)]">{description}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap items-end gap-2">{actions}</div>}
        </div>
    );
}
