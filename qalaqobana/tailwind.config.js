/**
 * ფერები და ფორმები აღებულია ბრენდის სახელმძღვანელოდან (ALTA — Design Refresh):
 * მუქი იისფერი ფონი, იისფერი → წითელი → ნარინჯისფერი გრადიენტები, "ფოთლის" ფორმის კუთხეები.
 * Tailwind-ის სტანდარტული violet / fuchsia / amber სკალები ბრენდის ფერებზეა გადაწყობილი,
 * ამიტომ კომპონენტებში კლასების სახელები უცვლელია.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // FiraGO გამოჩნდება, თუ მოწყობილობაზე დაყენებულია; სხვაგან — Noto Sans Georgian
        sans: ['FiraGO', '"Noto Sans Georgian"', 'Ubuntu', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ბრენდის იისფერი
        violet: {
          50: '#f6f2fa',
          100: '#ece4f5',
          200: '#d8c9ea',
          300: '#bba3d9',
          400: '#9a77c5',
          500: '#7d4eaf',
          600: '#662d91',
          700: '#562779',
          800: '#462462',
          900: '#3c2956',
          950: '#2a1c3e',
        },
        // აქცენტი: იისფერსა და წითელს შორის
        fuchsia: {
          50: '#fdf1f4',
          100: '#fbdfe6',
          200: '#f6bccb',
          300: '#ef8da5',
          400: '#e4587c',
          500: '#d6305f',
          600: '#c11f58',
          700: '#a01a4a',
          800: '#80183e',
          900: '#641634',
        },
        // ბრენდის ნარინჯისფერი
        amber: {
          50: '#fff7eb',
          100: '#feecd2',
          200: '#fcd9a6',
          300: '#fbb851',
          400: '#f9901b',
          500: '#f15a24',
          600: '#d9480f',
          700: '#b23a0c',
        },
        brand: {
          ink: '#3c2956',
          purple: '#662d91',
          magenta: '#92278f',
          red: '#eb1c24',
          flame: '#f15a24',
          orange: '#f9901b',
          mint: '#2dd5c4',
          paper: '#e5e6e8',
        },
      },
      borderRadius: {
        // "ფოთლის" ფორმა: ორი მოპირდაპირე კუთხე მომრგვალებულია, ორი — თითქმის მახვილი
        leaf: '0.5rem 1.75rem 0.5rem 1.75rem',
        'leaf-lg': '0.75rem 2.5rem 0.75rem 2.5rem',
        'leaf-sm': '0.3rem 1rem 0.3rem 1rem',
      },
      backgroundImage: {
        'brand-warm': 'linear-gradient(60deg, #eb1c24 0%, #f9901b 100%)',
        'brand-hot': 'linear-gradient(60deg, #92278f 0%, #eb1c24 100%)',
        'brand-full': 'linear-gradient(60deg, #662d91 0%, #eb1c24 55%, #f9901b 100%)',
        'brand-deep': 'linear-gradient(60deg, #3c2956 0%, #662d91 100%)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '70%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        fall: {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0.7' },
        },
        rise: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        pop: 'pop 0.45s ease-out both',
        shake: 'shake 0.3s ease-in-out infinite',
        fall: 'fall linear forwards',
        rise: 'rise 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
