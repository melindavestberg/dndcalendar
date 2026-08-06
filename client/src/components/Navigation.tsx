import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navigation.css';
import SettingsIcon from '../icons/settings.svg?react';
import MenuIcon from '../icons/hamburger.svg?react';
import { useTheme, THEME_OPTIONS, Theme } from '../hooks/useTheme';
import { User } from '../types';

interface NavigationProps {
  user: User | null;
  onLogout: () => void;
}

function Navigation({ user, onLogout }: NavigationProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [menu, setMenu] = useState(false);
  const [themeMenu, setThemeMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = () => {
    setMenu(false);
    onLogout();
    navigate('/login');
  };

  const toggleThemeMenu = () => {
    setThemeMenu(prev => !prev);
  };

  const handleSelectTheme = (next: Theme) => {
    setTheme(next);
    setThemeMenu(false);
    setMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenu(false);
        setThemeMenu(false);
      }
    };

    if (menu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menu]);

  const toggleMenu = () => {
    setMenu(prev => !prev);
    setThemeMenu(false);
  };

  const currentThemeOption = THEME_OPTIONS.find(option => option.value === theme);

  return (
    <nav className="navbar">
      <div className="nav-container-small">
        <Link to="/" className="nav-logo">
          D&D Calendar
        </Link>
        <button className="btn btn-secondary" onClick={toggleMenu} >
          <MenuIcon className="icon"/>
        </button>
      </div>
      { menu && (
          <div className="menu-container" ref={menuRef}>
            <Link to="/" className="menu-item nav-link" onClick={toggleMenu}>
              My Calendars
            </Link>
            <div className="menu-item nav-link theme-trigger" onClick={toggleThemeMenu}>
              Theme
              <span className="theme-swatch" style={{ backgroundColor: currentThemeOption?.swatch }} />
            </div>
            {themeMenu && (
              <div className="theme-options">
                {THEME_OPTIONS.map(option => (
                  <div
                    key={option.value}
                    className={`theme-option${option.value === theme ? ' active' : ''}`}
                    onClick={() => handleSelectTheme(option.value)}
                  >
                    <span className="theme-swatch" style={{ backgroundColor: option.swatch }} />
                    {option.label}
                  </div>
                ))}
              </div>
            )}
            <Link to="/settings" className="menu-item nav-link" onClick={toggleMenu}>
              Settings
              <SettingsIcon className="icon"/>
            </Link>
            <div className="menu-item nav-link" onClick={handleLogout}>
              Logout {user?.username}
            </div>
          </div>
      )
      }
    </nav>
  );
}

export default Navigation;
