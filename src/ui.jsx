import React from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react';
export const dateText = v => v ? v.replaceAll('-','.') : '기준일 미기재';
export function External({href,children,className=''}) {return href ? <a className={'external '+className} href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowSquareOut size={15}/><span className="sr-only"> (새 창)</span></a> : <span className="muted">미확인</span>;}
export function Tag({children,blue=false}) {return <span className={'tag '+(blue?'blue':'')}>{children}</span>;}
