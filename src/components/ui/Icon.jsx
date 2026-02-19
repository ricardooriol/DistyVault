import React from 'react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

const kebabToPascal = (str) =>
    str.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

export default function Icon({ name, size = 20, className, strokeWidth = 2, ...props }) {
    // Convert kebab-case (e.g. "arrow-right") to PascalCase (e.g. "ArrowRight")
    const pascalName = kebabToPascal(name);
    const LucideIcon = LucideIcons[pascalName];

    if (!LucideIcon) {
        console.warn(`Icon "${name}" not found in lucide-react`);
        return null;
    }

    return (
        <LucideIcon
            size={size}
            strokeWidth={strokeWidth}
            className={cn("dv-icon pointer-events-none inline-flex items-center justify-center", className)}
            {...props}
        />
    );
}
