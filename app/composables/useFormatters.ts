export function useFormatters() {
    function formatNumber(n: number): string {
        if (n >= 1_000_000) {
            return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
        }

        if (n >= 1_000) {
            return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
        }

        return n.toString()
    }

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    function formatDuration(seconds: number): string {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }
    return { formatNumber, formatDate, formatDuration }
}