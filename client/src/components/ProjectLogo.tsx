import { useState } from 'react';
import { Image } from '@client/src/components/ui/image';

const LOGO_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg'];

interface ProjectLogoProps {
  projectId: string;
  className?: string;
}

export function ProjectLogo({ projectId, className = 'size-11' }: ProjectLogoProps) {
  const [assetIndex, setAssetIndex] = useState(0);
  const logoUrl = assetIndex < LOGO_EXTENSIONS.length
    ? `${import.meta.env.BASE_URL}project-logos/${encodeURIComponent(projectId)}.${LOGO_EXTENSIONS[assetIndex]}`
    : null;

  if (!logoUrl) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-sm bg-primary font-mono text-xs font-semibold tracking-tight text-primary-foreground ${className}`}
        title={`${projectId} 默认图标`}
      >
        {projectId.slice(0, 4).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={`${projectId} 游戏 Logo`}
      className={`shrink-0 rounded-sm border border-border bg-muted object-cover ${className}`}
      onError={() => setAssetIndex((index) => index + 1)}
    />
  );
}
