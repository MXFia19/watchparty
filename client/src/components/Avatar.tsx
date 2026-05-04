interface AvatarProps {
  pseudo: string;
  src?: string | null;
  size?: number;
  className?: string;
}

export default function Avatar({ pseudo, src, size = 32, className = '' }: AvatarProps) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(pseudo)}&background=5b7fff&color=fff&size=${size * 2}`;

  return (
    <img
      src={src || fallback}
      alt={pseudo}
      width={size}
      height={size}
      className={`rounded-full object-cover flex-shrink-0 ${className}`}
      onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
      style={{ width: size, height: size }}
    />
  );
}
