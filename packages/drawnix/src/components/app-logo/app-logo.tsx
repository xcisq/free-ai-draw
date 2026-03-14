import React from 'react';
import './app-logo.scss';

export interface AppLogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'light' | 'dark';
  className?: string;
}

/**
 * XAI Board Logo 组件
 * 用于在应用各处显示 XAI Logo
 */
export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'medium',
  variant = 'default',
  className = ''
}) => {
  return (
    <div className={`app-logo app-logo--${size} app-logo--${variant} ${className}`}>
      <img src="/logo/xai.svg" alt="XAI" />
    </div>
  );
};

AppLogo.displayName = 'AppLogo';
