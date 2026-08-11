import { useEffect, useState } from 'react';
import { useCurrentUserProfile } from '@lark-apaas/client-toolkit/hooks/useCurrentUserProfile';

const WorkbenchGreeting = () => {
  const user = useCurrentUserProfile();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hour = now.getHours();
  let greeting = '你好';
  if (hour < 6) greeting = '凌晨好';
  else if (hour < 12) greeting = '早上好';
  else if (hour < 14) greeting = '中午好';
  else if (hour < 18) greeting = '下午好';
  else greeting = '晚上好';

  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`;
  const userName = user.name || '用户';

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
        {greeting}，<span className="text-primary">{userName}</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground font-mono">{dateStr}</p>
    </div>
  );
};

export { WorkbenchGreeting };
