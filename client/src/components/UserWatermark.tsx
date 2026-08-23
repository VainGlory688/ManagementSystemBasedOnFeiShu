import { useCurrentUserProfile } from '@lark-apaas/client-toolkit/hooks/useCurrentUserProfile';

export function UserWatermark() {
  const user = useCurrentUserProfile();
  const userName = user.name || '用户';

  return (
    <div className="user-watermark" aria-hidden="true">
      {Array.from({ length: 40 }, (_, index) => (
        <span key={index} className="user-watermark__item">{userName}</span>
      ))}
    </div>
  );
}
